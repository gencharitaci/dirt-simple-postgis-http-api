// routes/feature/mvt/mvt.route.js
import { errorResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

/**
 * Query URL Sample:
 * http://localhost:3009/api/v1/mvt/tax_parcels/14/4516/6478?geom_column=the_geom
 * table: tax_parcels, z:14, x:4516, y:6478
 */

const sql = (params, query) => {
  const { table, z, x, y } = params;
  const {
    geom_column = 'the_geom',
    columns,
    id_column,
    filter
  } = query;

  return `
    WITH mvtgeom AS (
      SELECT
        ST_AsMVTGeom(
          ST_Transform(${geom_column}, 3857),
          ST_TileEnvelope(${z}, ${x}, ${y})
        ) AS geom
        ${columns ? `, ${columns}` : ''}
        ${id_column ? `, ${id_column}` : ''}
      FROM
        ${table},
        (
          SELECT ST_SRID(${geom_column}) AS srid
          FROM ${table}
          WHERE ${geom_column} IS NOT NULL
          LIMIT 1
        ) a
      WHERE
        ST_Intersects(
          ${geom_column},
          ST_Transform(
            ST_TileEnvelope(${z}, ${x}, ${y}),
            srid
          )
        )
        ${filter ? `AND ${filter}` : ''}
    )
    SELECT ST_AsMVT(
      mvtgeom.*,
      '${table}',
      4096,
      'geom'
      ${id_column ? `, '${id_column}'` : ''}
    ) AS mvt
    FROM mvtgeom;
  `;
};

const schema = {
  description: 'Return table as Mapbox Vector Tile (MVT).',
  tags: [routeTag(import.meta.url)],
  summary: 'Return MVT',
  params: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table or view name.' },
      z: { type: 'integer', description: 'Tile Z' },
      x: { type: 'integer', description: 'Tile X' },
      y: { type: 'integer', description: 'Tile Y' }
    },
    required: ['table', 'z', 'x', 'y']
  },
  querystring: {
    type: 'object',
    properties: {
      geom_column: { type: 'string', description: 'Geometry column.', default: 'the_geom' },
      columns: { type: 'string', description: 'Optional columns.' },
      id_column: { type: 'string', description: 'Optional ID column.' },
      filter: { type: 'string', description: 'Optional SQL WHERE filter.' }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/mvt/:table/:z/:x/:y',
    schema,
    handler: async (request, reply) => {
      const { params, query } = request;
      const client = await fastify.pg.connect();

      try {
        const sqlText = sql(params, query);
        request.log.info({
          sql: sqlText,
          params,
          query
        }, 'Executing MVT SQL');

        const result = await client.query(sqlText);
        const mvt = result.rows[0]?.mvt;
        if (!mvt || mvt.length === 0) {
          return reply.code(204).send(); // No Content
        }
        return reply
          .header('Content-Type', 'application/x-protobuf')
          .send(mvt);
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: sql(params, query)
        }, 'MVT Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
