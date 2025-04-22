// routes/api/query/query.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table } = params;
  const {
    columns = "*",
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
  `;
};


const schema = {
  description: 'Query a table or view.',
  tags: [routeTag(import.meta.url)],
  summary: 'Table query',
  params: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'Table or view name.'
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
        description: 'Optional SQL WHERE filter.'
      },
      sort: {
        type: 'string',
        description: 'Optional ORDER BY column(s).'
      },
      group: {
        type: 'string',
        description: 'Optional GROUP BY column(s).'
      },
      limit: {
        type: 'integer',
        description: 'Limit number of rows.',
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
        request.log.info(`Executing SQL: ${sqlText}`);
        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({ err }, 'QUERY TABLE Query Error');
        return reply.code(500).send(errorResponse('Query execution error.'));
      } finally {
        client.release();
      }
    }
  });

  next();
};