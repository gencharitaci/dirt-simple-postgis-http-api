// routes/api/centroid/centroid.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table } = params;
  const {
    geom_column = 'the_geom',
    srid,
    filter,
    force_on_surface
  } = query;

  const targetSrid = parseInt(srid, 10) || 4326;
  const transformFunction = force_on_surface ? 'ST_PointOnSurface' : 'ST_Centroid';
  const whereClause = filter ? `WHERE ${filter}` : '';

  return `
    SELECT
      ST_X(geom_transformed) AS x,
      ST_Y(geom_transformed) AS y
    FROM (
      SELECT
        ST_Transform(${transformFunction}(${geom_column}), ${targetSrid}) AS geom_transformed
      FROM
        ${table}
      ${whereClause}
    ) AS sub;
  `;
};

const schema = {
  description: 'Get the centroids of feature(s).',
  tags: [routeTag(import.meta.url)],
  summary: 'Feature(s) centroids',
  params: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'The name of the table or view to query.'
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
      srid: {
        type: 'integer',
        description: 'The SRID for the returned centroids.',
        default: 4326
      },
      filter: {
        type: 'string',
        description: 'Optional filter parameters for a SQL WHERE statement. .'
      },
      force_on_surface: {
        type: 'boolean',
        description: 'Set true to force point on surface. The default is false.',
        default: false
      }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/centroid/:table',
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
        }, 'Executing CENTROID SQL');

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: sql(params, query)
        }, 'CENTROID Query Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
