// routes/api/transform-point/transform-point.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { point } = params;
  const { srid = 4326 } = query;

  const pointMatch = point.match(/^((-?\d+\.?\d+),(-?\d+\.?\d+),(\d{4}))$/);
  if (!pointMatch) {
    throw new Error('Invalid point format. Expected format: x,y,srid (e.g., 29.1234,41.5678,4326)');
  }

  const [x, y, sourceSrid] = pointMatch[0].split(',').map(Number);
  const targetSrid = parseInt(srid, 10) || 4326;

  return `
    SELECT
      ST_X(
        ST_Transform(
          ST_SetSRID(ST_MakePoint(${x}, ${y}), ${sourceSrid}),
          ${targetSrid}
        )
      ) AS x,
      ST_Y(
        ST_Transform(
          ST_SetSRID(ST_MakePoint(${x}, ${y}), ${sourceSrid}),
          ${targetSrid}
        )
      ) AS y
  `;
};

const schema = {
  description: 'Transform a point from one coordinate system to another.',
  tags: [routeTag(import.meta.url)],
  summary: 'Transform point coordinates',
  params: {
    type: 'object',
    properties: {
      point: {
        type: 'string',
        pattern: '^((-?\\d+\\.?\\d+),(-?\\d+\\.?\\d+),(\\d{4}))$',
        description: 'Point as X,Y,SRID.'
      }
    },
    required: ['point']
  },
  querystring: {
    type: 'object',
    properties: {
      srid: {
        type: 'integer',
        description: 'Target SRID for the transformation. The default is <em>4326</em> WGS84 Lat/Lng.',
        default: 4326
      }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/transform_point/:point',
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
        }, 'Executing TRANSFORM-POINT SQL');

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows[0]));
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: sql(params, query)
        }, 'TRANSFORM-POINT Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
