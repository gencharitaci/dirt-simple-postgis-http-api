// routes/meta/list-columns/list-columns.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { table } = params;

  return `
    SELECT
      attname AS field_name,
      typname AS field_type
    FROM
      pg_namespace,
      pg_attribute,
      pg_type,
      pg_class
    WHERE
      pg_type.oid = atttypid
      AND pg_class.oid = attrelid
      AND relnamespace = pg_namespace.oid
      AND attnum >= 1
      AND relname = '${table}'
  `;
};



const schema = {
  description: 'Returns a list of columns in the specified table.',
  tags: [routeTag(import.meta.url)],
  summary: 'List table columns',
  params: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'The name of the table or view.'
      }
    },
    required: ['table']
  }
};

export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/list_columns/:table',
    schema,
    handler: async (request, reply) => {
      const params = request.params;
      const client = await fastify.pg.connect();

      try {

        const sqlText = sql(params);
        request.log.info(`Executing SQL: ${sqlText}`);

        const result = await client.query(sqlText);

        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({ err }, 'List Columns Query Error');
        return reply.code(500).send(errorResponse('Query execution error.'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
