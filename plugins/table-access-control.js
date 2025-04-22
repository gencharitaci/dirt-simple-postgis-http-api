import fp from 'fastify-plugin'
import validateAccess from '../utils/is-allowed.js'

async function tableAccessControl(fastify, opts) {
    fastify.addHook('preHandler', async (request, reply) => {
        const { table, table_from, table_to } = request.params || {}

        if (table) {
            const check = validateAccess(table)
            if (!check.ok) {
                return reply.code(400).send({ success: false, message: check.reason })
            }
        }

        if (table_from) {
            const checkFrom = validateAccess(table_from)
            if (!checkFrom.ok) {
                return reply.code(400).send({ success: false, message: checkFrom.reason })
            }
        }

        if (table_to) {
            const checkTo = validateAccess(table_to)
            if (!checkTo.ok) {
                return reply.code(400).send({ success: false, message: checkTo.reason })
            }
        }
    })
}

export default fp(tableAccessControl);