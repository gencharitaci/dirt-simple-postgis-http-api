// routes/api/nearest/nearest.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table, point } = params;
  const {
    geom_column = 'the_geom',
    columns,
    filter,
    limit,
  } = query;

  const pointMatch = params.point.match(/^((-?\d+\.?\d+),(-?\d+\.?\d+),(\d{4}))$/);
  if (!pointMatch) {
    throw new Error('Invalid point format. Expected format: x,y,srid (e.g., 29.1234,41.5678,4326)');
  }

  const [x, y, srid] = pointMatch[0].split(',').map(Number);

  return `
    WITH input_geom AS (
      SELECT 
        ST_Transform(ST_SetSRID(ST_MakePoint(${x}, ${y}), ${srid}), srid) AS geom,
        srid
      FROM (
        SELECT ST_SRID(${geom_column}) AS srid
        FROM ${table}
        WHERE ${geom_column} IS NOT NULL
        LIMIT 1
      ) AS sub
    )

    SELECT
      ${columns},
      ST_Distance(${geom_column}, input_geom.geom) AS distance
    FROM
      ${table}, input_geom
    ${filter ? `WHERE ${filter}` : ''}
    ORDER BY
      ${geom_column} <-> input_geom.geom
    LIMIT ${limit};
  `;
};


const schema = {
  description: 'Find the records closest to a point ordered by distance.',
  tags: [routeTag(import.meta.url)],
  summary: 'Records closest to point',
  params: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'Table name.'
      },
      point: {
        type: 'string',
        pattern: '^((-?\\d+\\.?\\d+),(-?\\d+\\.?\\d+),(\\d{4}))$',
        description: 'Point as X,Y,SRID.'
      }
    },
    required: ['table', 'point']
  },
  querystring: {
    type: 'object',
    properties: {
      geom_column: {
        type: 'string',
        description: 'Geometry column.',
        default: 'the_geom'
      },
      columns: {
        type: 'string',
        description: 'Columns to return.',
        default: '*'
      },
      filter: {
        type: 'string',
        description: 'Optional SQL WHERE filter.'
      },
      limit: {
        type: 'integer',
        description: 'Limit the number of results.',
        default: 10
      }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/nearest/:table/:point',
    schema,
    handler: async (request, reply) => {
      const { params, query } = request;

      const client = await fastify.pg.connect();

      try {
        const sqlText = sql(params, query);
        request.log.info(`Executing SQL: ${sqlText}`);

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({ err }, 'NEAREST Query Error');
        return reply.code(500).send(errorResponse('Query execution error.'));
      } finally {
        if (client) client.release();
      }
    }
  });

  next();
};
