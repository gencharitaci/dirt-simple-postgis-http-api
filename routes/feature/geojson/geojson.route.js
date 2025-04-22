// routes/feature/geojson/geojson.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table } = params;
  const {
    geom_column = 'the_geom',
    columns,
    id_column,
    filter,
    bounds,
    precision
  } = query;

  const numericBounds = bounds ? bounds.split(',').map(Number) : null;
  const parsedPrecision = parseInt(precision, 10) || 9;

  const whereClauses = [];

  if (filter) { whereClauses.push(filter); }

  if (numericBounds && numericBounds.length === 4) {
    whereClauses.push(`
      ${geom_column} &&
      ST_Transform(
        ST_MakeEnvelope(${numericBounds.join()}, 4326),
        srid
      )
    `);
  }

  if (numericBounds && numericBounds.length === 3) {
    whereClauses.push(`
      ${geom_column} &&
      ST_Transform(
        ST_TileEnvelope(${numericBounds.join()}),
        srid
      )
    `);
  }

  return `
    SELECT
      jsonb_build_object(
        'type', 'Feature',
        ${id_column ? `'id', ${id_column},` : ''}
        'geometry', ST_AsGeoJSON(geom, ${parsedPrecision})::jsonb,
        'properties', to_jsonb(subq.*) - 'geom' ${id_column ? `- '${id_column}'` : ''}
      ) AS geojson
    FROM (
      SELECT
        ST_Transform(${geom_column}, 4326) AS geom
        ${columns ? `, ${columns}` : ''}
        ${id_column ? `, ${id_column}` : ''}
      FROM
        ${table},
        (SELECT ST_SRID(${geom_column}) AS srid FROM ${table} WHERE ${geom_column} IS NOT NULL LIMIT 1) AS a
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
    ) AS subq;
  `;
};


const schema = {
  description: 'Return table as GeoJSON.',
  tags: [routeTag(import.meta.url)],
  summary: 'Return GeoJSON',
  params: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'The name of the table or view.'
      }
    },
    required: ['table']
  },
  querystring: {
    type: 'object',
    properties: {
      geom_column: {
        type: 'string',
        description: 'The geometry column of the table.',
        default: 'the_geom'
      },
      columns: {
        type: 'string',
        description: 'Columns to return as GeoJSON properties.'
      },
      id_column: {
        type: 'string',
        description: 'Optional id column for Mapbox Feature State.'
      },
      filter: {
        type: 'string',
        description: 'Optional SQL WHERE filter.'
      },
      bounds: {
        type: 'string',
        pattern: '^-?[0-9]{0,20}.?[0-9]{1,20}?(,-?[0-9]{0,20}.?[0-9]{1,20}?){2,3}$',
        description: 'Bounding box or tile envelope.'
      },
      precision: {
        type: 'integer',
        description: 'Max decimal places (default 9).',
        default: 9
      }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/geojson/:table',
    schema,
    handler: async (request, reply) => {
      const { params, query } = request;
      const client = await fastify.pg.connect();

      try {
        const sqlText = sql(params, query);
        request.log.info(`Executing SQL: ${sqlText}`);
        const result = await client.query(sqlText);
        if (result.rows.length === 0) {
          return reply.code(204).send(); // No Content
        }
        const geojson = {
          type: 'FeatureCollection',
          features: result.rows.map((el) => el.geojson)
        };
        return reply.send(successResponse(geojson));
      } catch (err) {
        request.log.error({ err }, 'GEOJSON Query Error');
        return reply.code(500).send(errorResponse('Query execution error.'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
