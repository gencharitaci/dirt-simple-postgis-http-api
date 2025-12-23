// routes/api/intersect-point/intersect-point.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table, point } = params;
  const { geom_column = 'geom', columns = '*', filter, distance = 0, sort, limit } = query;

  const pointMatch = point.match(/^((-?\d+\.?\d+),(-?\d+\.?\d+),(\d{4}))$/);
  if (!pointMatch) {
    throw new Error('Invalid point format. Expected format: x,y,srid (e.g., 29.1234,41.5678,4326)');
  }

  const [x, y, srid] = pointMatch[0].split(',').map(Number);
  return `
  SELECT
    ${columns}

  FROM
    ${table}

  WHERE
    ST_DWithin(
      ${geom_column},
      ST_Transform(
        st_setsrid(
          st_makepoint(${x}, ${y}),
          ${srid}
        ),
        (SELECT ST_SRID(${geom_column}) FROM ${table} LIMIT 1)
      ),
      ${distance}
    )
    -- Optional Filter
    ${filter ? `AND ${filter}` : ''}

  -- Optional sort
  ${sort ? `ORDER BY ${sort}` : ''}

  -- Optional limit
  ${limit ? `LIMIT ${limit}` : ''}
  `;
};

/*
const sql = (params, query) => {
  const { table, point } = params;
  const {
    geom_column = 'geom',
    columns = '*',
    filter,
    distance = 0,
    sort,
    limit,
  } = query;

  const pointMatch = point.match(/^((-?\d+\.?\d+),(-?\d+\.?\d+),(\d{4}))$/);
  if (!pointMatch) {
    throw new Error('Invalid point format. Expected format: x,y,srid (e.g., 29.1234,41.5678,4326)');
  }

  const [x, y, srid] = pointMatch[0].split(',').map(Number);

  return `
    WITH input_geom AS (
      SELECT ST_Transform(ST_SetSRID(ST_MakePoint(${x}, ${y}), ${srid}), srid)
        AS geom, srid
      FROM (
        SELECT ST_SRID(${geom_column}) AS srid
        FROM ${table}
        WHERE ${geom_column} IS NOT NULL
        LIMIT 1
      ) AS srid_sub
    )
    SELECT
      ${columns},
      ST_Distance(${geom_column}, input_geom.geom) AS distance
    FROM
      ${table}, input_geom
    WHERE
      ST_DWithin(${geom_column}, input_geom.geom, ${distance})
      ${filter ? `AND ${filter}` : ''}
    ${sort ? `ORDER BY ${sort}` : ''}
    ${limit ? `LIMIT ${limit}` : ''}
  `;
};
*/

const schema = {
  description: 'Get features that intersect with a point.',
  tags: [routeTag(import.meta.url)],
  summary: 'Features intersecting with point',
  params: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'The name of the table or view to query.',
      },
      point: {
        type: 'string',
        pattern: '^((-?\\d+\\.?\\d+),(-?\\d+\\.?\\d+),(\\d{4}))$',
        description: 'A point expressed as X,Y,SRID.',
      },
    },
    required: ['table', 'point'],
  },
  querystring: {
    type: 'object',
    properties: {
      geom_column: {
        type: 'string',
        description: 'The geometry column of the table.',
        default: 'geom',
      },
      columns: {
        type: 'string',
        description: 'Columns to return.',
        default: '*',
      },
      filter: {
        type: 'string',
        description: 'Optional filter parameters for a SQL WHERE statement. .',
      },
      distance: {
        type: 'integer',
        description: 'Distance for ST_DWithin.',
        default: 0,
      },
      sort: {
        type: 'string',
        description: 'Optional sort column(s).',
      },
      limit: {
        type: 'integer',
        description: 'Optional limit of rows.',
      },
    },
  },
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/intersect_point/:table/:point',
    schema,
    handler: async (request, reply) => {
      const { params, query } = request;
      const client = await fastify.pg.connect();

      try {
        const sqlText = sql(params, query);
        request.log.info(
          {
            sql: sqlText,
            params,
            query,
          },
          'Executing INTERSECT-POINT SQL'
        );

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error(
          {
            err,
            params,
            query,
            sql: sql(params, query),
          },
          'INTERSECT-POINT Query Error'
        );
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    },
  });

  next();
}
