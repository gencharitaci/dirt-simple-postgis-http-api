// routes/meta/list-tables/list-tables.route.js
import { errorResponse, successResponse } from '../../../utils/response.js';
import { routeTag } from '../../../utils/route-tag.js';

const sql = (params, query) => {
  const { filter } = query;

  return `
    SELECT
      i.table_name,
      i.table_type,
      g.f_geometry_column AS geometry_column,
      g.coord_dimension,
      g.srid,
      g.type
    FROM
      information_schema.tables i
    LEFT JOIN
      geometry_columns g
      ON i.table_name = g.f_table_name
    INNER JOIN
      information_schema.table_privileges p
      ON i.table_name = p.table_name
      AND p.grantee IN (CURRENT_USER, 'PUBLIC')
      AND p.privilege_type = 'SELECT'
    WHERE
      i.table_schema NOT IN ('pg_catalog', 'information_schema')
      ${filter ? `AND ${filter}` : ''}
    ORDER BY
      i.table_name;
  `;
};


const schema = {
  description: 'List tables and views with geometry info (User must have SELECT privilege).',
  tags: [routeTag(import.meta.url)],
  summary: 'List Tables & Views',
  querystring: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional WHERE filter for advanced usage.'
      }
    }
  }
};


export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/list_tables',
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
        }, 'Executing LIST-TABLES SQL');

        const result = await client.query(sqlText);
        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({
          err,
          params,
          query,
          sql: sql(params, query)
        }, 'LIST-TABLES Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  });

  next();
};
