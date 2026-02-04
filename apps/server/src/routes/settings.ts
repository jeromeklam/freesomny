import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { parseJsonObject, stringifyJson } from '../lib/json.js'
import { DEFAULT_SETTINGS, type AppSettings } from '@api-client/shared'

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get settings
  fastify.get('/api/settings', async () => {
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    })

    if (!settings) {
      return { data: DEFAULT_SETTINGS }
    }

    return { data: parseJsonObject<AppSettings>(settings.data) }
  })

  // Update settings
  fastify.put<{ Body: unknown }>('/api/settings', async (request) => {
    const data = request.body as Partial<AppSettings>

    // Get current settings
    const current = await prisma.settings.findUnique({
      where: { id: 'default' },
    })

    const currentData = current
      ? parseJsonObject<AppSettings>(current.data)
      : DEFAULT_SETTINGS

    // Merge settings
    const merged: AppSettings = {
      proxy: { ...currentData.proxy, ...data.proxy },
      ssl: { ...currentData.ssl, ...data.ssl },
      docker: { ...currentData.docker, ...data.docker },
      timeout: data.timeout ?? currentData.timeout,
    }

    // Upsert settings
    await prisma.settings.upsert({
      where: { id: 'default' },
      create: { id: 'default', data: stringifyJson(merged) },
      update: { data: stringifyJson(merged) },
    })

    return { data: merged }
  })
}
