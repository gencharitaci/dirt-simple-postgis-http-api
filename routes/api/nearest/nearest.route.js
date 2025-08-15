// routes/api/nearest/nearest.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = async (client, params, query) => {
  const { table, point } = params;
  let {
    geom_column,
    columns,
    filter,
    limit,
  } = query;

  const pointMatch = point.match(/^((-?\d+\.?\d+),(-?\d+\.?\d+),(\d{4}))$/);
  if (!pointMatch) {
    throw new Error('Invalid point format. Expected format: x,y,srid (e.g., 29.1234,41.5678,4326)');
  }

  const [x, y, srid] = point.split(',').map(Number);

  // Check if provided geom_column is valid
  // if geom_column not equal to 'the_geom, try with geom_column='geom'
  /*
   *  cms_parcels and cms_parcels_future_py geom_column='geom', all others geom_column='the_geom'
   */
  try {
    await client.query(`SELECT * FROM ${table} WHERE ${geom_column} IS NOT NULL LIMIT 1`);
  } catch (err) {
    // If not, try with 'geom'
    geom_column = 'geom';
    try {
      await client.query(`SELECT * FROM ${table} WHERE ${geom_column} IS NOT NULL LIMIT 1`);
    } catch (err) {
      throw new Error(`No valid geometry column found in table "${table}"`);
    }
  }

  // Return SQL string using direct ST_Transform instead of CTE
  return `
    SELECT
      ${columns},
      ST_Distance(
        ST_Transform(
          ST_SetSRID(ST_MakePoint(${x}, ${y}), ${srid}),
          (SELECT ST_SRID(${geom_column}) FROM ${table} WHERE ${geom_column} IS NOT NULL LIMIT 1)
        ),
        ${geom_column}
      ) AS distance

    FROM
      ${table}

    ${filter ? `WHERE ${filter}` : ''}

    ORDER BY
      ${geom_column} <-> ST_Transform(
        ST_SetSRID(ST_MakePoint(${x}, ${y}), ${srid}),
        (SELECT ST_SRID(${geom_column}) FROM ${table} WHERE ${geom_column} IS NOT NULL LIMIT 1)
      )

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
        const sqlText = await sql(client, params, query);
        request.log.info({
          sql: sqlText,
          params,
          query
        }, 'Executing NEAREST SQL');

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: typeof sqlText !== 'undefined' ? sqlText : '[SQL generation failed]'
        }, 'NEAREST Query Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
