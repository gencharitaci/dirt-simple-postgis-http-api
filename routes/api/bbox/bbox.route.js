// routes/api/bbox/bbox.route.js
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
  const transformFn = force_on_surface === 'true' ? 'ST_PointOnSurface' : 'ST_Centroid';
  const whereClause = filter ? `WHERE ${filter}` : '';

  return `
    SELECT
      ST_X(ST_Transform(${transformFn}(${geom_column}), ${targetSrid})) AS x,
      ST_Y(ST_Transform(${transformFn}(${geom_column}), ${targetSrid})) AS y
    FROM ${table}
    ${whereClause}
  `.trim();
};


// route schema
const schema = {
  description: 'Gets the bounding box of a feature(s).',
  tags: [routeTag(import.meta.url)],
  summary: 'minimum bounding rectangle',
  params: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'The name of the table or view to query.'
      }
    }
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
        description: 'The SRID for the returned centroid. The default is <em>4326</em> WGS84 Lat/Lng.',
        default: 4326
      },
      filter: {
        type: 'string',
        description: 'Optional filter parameters for a SQL WHERE statement.'
      }
    }
  }
}

// Create Route
export default function (fastify, opts, next) {
  fastify.route({
    method: 'GET',
    url: '/bbox/:table',
    schema,
    handler: async (request, reply) => {
      const { params, query } = request;
      const client = await fastify.pg.connect();

      try {
        const sqlText = sql(params, query);
        request.log.info({ sql: sqlText }, 'Executing BBOX SQL');

        const result = await client.query(sqlText);

        return reply.send(successResponse(result.rows));
      } catch (err) {
        request.log.error({ err }, 'BBOX Query Error');
        return reply.code(500).send(errorResponse('Database query error'));
      } finally {
        client.release();
      }
    }
  })

  next();
};

