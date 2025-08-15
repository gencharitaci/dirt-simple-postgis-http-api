// routes/api/intersect-feature/intersect-feature.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table_from, table_to } = params;
  const {
    geom_column_from = 'the_geom',
    geom_column_to = 'the_geom',
    columns = '*',
    filter,
    distance = 0,
    sort,
    limit
  } = query;

  const whereClauses = [
    `ST_DWithin(${table_from}.${geom_column_from}, ${table_to}.${geom_column_to}, ${Number(distance)})`
  ];

  if (filter) {
    whereClauses.push(filter);
  }

  return `
    SELECT
      ${columns}
    FROM
      ${table_from}
    CROSS JOIN
      ${table_to}
    WHERE
      ${whereClauses.join(' AND ')}
    ${sort ? `ORDER BY ${sort}` : ''}
    ${limit ? `LIMIT ${parseInt(limit)}` : ''}
  `;
};

const schema = {
  description: 'Intersect features within distance.',
  tags: [routeTag(import.meta.url)],
  summary: 'Return intersected features within distance',
  params: {
    type: 'object',
    properties: {
      table_from: {
        type: 'string',
        description: 'Source table'
      },
      table_to: {
        type: 'string',
        description: 'Target table'
      }
    },
    required: ['table_from', 'table_to']
  },
  querystring: {
    type: 'object',
    properties: {
      geom_column_from: {
        type: 'string',
        description: 'Geometry column of from table.',
        default: 'the_geom'
      },
      geom_column_to: {
        type: 'string',
        description: 'Geometry column of to table.',
        default: 'the_geom'
      },
      columns: {
        type: 'string',
        description: 'Columns to return.',
        default: '*'
      },
      filter: {
        type: 'string',
        description: 'Optional WHERE clause. .'
      },
      distance: {
        type: 'integer',
        description: 'Distance for ST_DWithin.',
        default: 0
      },
      sort: {
        type: 'string',
        description: 'Optional sort column(s).'
      },
      limit: {
        type: 'integer',
        description: 'Optional limit of rows.'
      }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/intersect_feature/:table_from/:table_to',
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
        }, 'Executing INTERSECT-FEATURE SQL');

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: sql(params, query)
        }, 'INTERSECT-FEATURE Query Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
