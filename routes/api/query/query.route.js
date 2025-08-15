// routes/api/query/query.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table } = params;
  const {
    columns,
    filter,
    sort,
    group,
    limit,
  } = query;

  return `
    SELECT
      ${columns}
    FROM
      ${table}
    ${filter ? `WHERE ${filter}` : ''}
    ${group ? `GROUP BY ${group}` : ''}
    ${sort ? `ORDER BY ${sort}` : ''}
    ${limit ? `LIMIT ${limit}` : ''}
  `
};

const schema = {
  description: 'Execute a SQL query on a table.',
  tags: [routeTag(import.meta.url)],
  summary: 'SQL query on table',
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
      columns: {
        type: 'string',
        description: 'Columns to return.',
        default: '*'
      },
      filter: {
        type: 'string',
        description: 'Optional filter parameters for a SQL WHERE statement. .'
      },
      sort: {
        type: 'string',
        description: 'Optional ORDER BY clause.'
      },
      group: {
        type: 'string',
        description: 'Optional GROUP BY clause.'
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of records to return.',
        default: 100
      }
    }
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/query/:table',
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
        }, 'Executing QUERY SQL');

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: sql(params, query)
        }, 'QUERY Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};