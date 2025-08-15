// routes/feature/geobuf/geobuf.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table } = params;
  const {
    geom_column = 'the_geom',
    columns,
    filter,
    bounds
  } = query;

  const boundsArray = bounds ? bounds.split(',').map(Number) : null;
  const boundsLength = boundsArray?.length;

  const hasBounds = boundsLength === 4 || boundsLength === 3;
  const decodedFilter = filter ? decodeURIComponent(filter) : null;
  const hasFilter = !!decodedFilter;

  const boundsCondition = hasBounds
    ? `${geom_column} && ST_Transform(
        ${boundsLength === 4
      ? `ST_MakeEnvelope(${boundsArray.join(',')}, 4326)`
      : `ST_TileEnvelope(${boundsArray.join(',')})`
    },
        srid
      )`
    : '';

  const whereClauses = [
    hasFilter ? `${decodedFilter}` : null,
    hasBounds ? boundsCondition : null
  ].filter(Boolean).join(' AND ');

  return `
    WITH srid_cte AS (
      SELECT ST_SRID(${geom_column}) AS srid
      FROM ${table}
      WHERE ${geom_column} IS NOT NULL
      LIMIT 1
    )

    SELECT ST_AsGeobuf(q, 'geom')
    FROM (
      SELECT
        ST_Transform(${geom_column}, 4326) AS geom
        ${columns ? `, ${columns}` : ''}
      FROM
        ${table}, srid_cte
      ${whereClauses ? `WHERE ${whereClauses}` : ''}
    ) AS q;
  `;
};

const schema = {
  description: 'Return records as Geobuf, a protobuf encoding of GeoJSON.',
  tags: [routeTag(import.meta.url)],
  summary: 'Return Geobuf',
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
        description:
          'Columns to return as GeoJSON properites. The default is geometry only. <br/><em>Note: the geometry column should not be listed here, and columns must be explicitly named.</em>'
      },
      filter: {
        type: 'string',
        description: 'Optional filter parameters for a SQL WHERE statement. .'
      },
      bounds: {
        type: 'string',
        pattern:
          '^-?[0-9]{0,20}.?[0-9]{1,20}?(,-?[0-9]{0,20}.?[0-9]{1,20}?){2,3}$',
        description:
          'Optionally limit output to features that intersect bounding box. Can be expressed as a bounding box (sw.lng, sw.lat, ne.lng, ne.lat) or a Z/X/Y tile (0,0,0).'
      }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/geobuf/:table',
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
        }, 'Executing GEOBUF SQL');

        const result = await client.query(sqlText);
        if (!result.rows[0]?.st_asgeobuf) {
          return reply.code(204).send(); // No Content
        }
        return reply
          .header('Content-Type', 'application/x-protobuf')
          .send(successResponse(result.rows[0].st_asgeobuf));
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: sql(params, query)
        }, 'GEOBUF Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
