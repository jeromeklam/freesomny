import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { stringifyJson } from '../lib/json.js'
import { importPostman, importHoppscotch, parseCurl, toCurl, importOpenAPI, exportOpenAPI } from '@api-client/import-export'
import type { AuthType, AuthConfig, KeyValueItem } from '@api-client/shared'

interface ImportedFolder {
  name: string
  description: string
  headers: Array<{ key: string; value: string; description?: string; enabled: boolean }>
  queryParams: Array<{ key: string; value: string; description?: string; enabled: boolean }>
  authType: string
  authConfig: Record<string, unknown>
  preScript: string | null
  postScript: string | null
  baseUrl: string | null
  children: ImportedFolder[]
  requests: ImportedRequest[]
}

interface ImportedRequest {
  name: string
  description: string
  method: string
  url: string
  headers: Array<{ key: string; value: string; description?: string; enabled: boolean }>
  queryParams: Array<{ key: string; value: string; description?: string; enabled: boolean }>
  bodyType: string
  body: string
  authType: string
  authConfig: Record<string, unknown>
  preScript: string | null
  postScript: string | null
}

async function createFolderRecursive(folder: ImportedFolder, parentId: string | null = null): Promise<string> {
  const created = await prisma.folder.create({
    data: {
      name: folder.name,
      description: folder.description,
      parentId,
      headers: stringifyJson(folder.headers),
      queryParams: stringifyJson(folder.queryParams),
      authType: folder.authType,
      authConfig: stringifyJson(folder.authConfig),
      preScript: folder.preScript,
      postScript: folder.postScript,
      baseUrl: folder.baseUrl,
    },
  })

  for (let i = 0; i < folder.requests.length; i++) {
    const request = folder.requests[i]
    await prisma.request.create({
      data: {
        name: request.name,
        description: request.description,
        method: request.method,
        url: request.url,
        headers: stringifyJson(request.headers),
        queryParams: stringifyJson(request.queryParams),
        bodyType: request.bodyType,
        body: request.body,
        authType: request.authType,
        authConfig: stringifyJson(request.authConfig),
        preScript: request.preScript,
        postScript: request.postScript,
        folderId: created.id,
        sortOrder: i,
      },
    })
  }

  for (let i = 0; i < folder.children.length; i++) {
    const child = folder.children[i]
    await createFolderRecursive(child, created.id)
  }

  return created.id
}

export async function importRoutes(fastify: FastifyInstance) {
  // Import Postman collection
  fastify.post<{ Body: { collection: unknown } }>('/api/import/postman', async (request) => {
    try {
      const { folder, environments } = importPostman(request.body.collection as Parameters<typeof importPostman>[0])
      const folderId = await createFolderRecursive(folder as ImportedFolder)

      // Create environments with extracted variables
      const envIds: string[] = []
      for (const env of environments) {
        const created = await prisma.environment.create({
          data: {
            name: env.name,
            description: env.description,
          },
        })
        envIds.push(created.id)

        for (const v of env.variables) {
          await prisma.environmentVariable.create({
            data: {
              environmentId: created.id,
              key: v.key,
              value: v.value,
              description: v.description,
              type: v.type,
              isSecret: v.isSecret,
            },
          })
        }
      }

      return { data: { success: true, folderId, environmentIds: envIds } }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to import Postman collection' }
    }
  })

  // Import Hoppscotch collection
  fastify.post<{ Body: { collection: unknown } }>('/api/import/hoppscotch', async (request) => {
    try {
      const { folder, environments } = importHoppscotch(request.body.collection as Parameters<typeof importHoppscotch>[0])
      const folderId = await createFolderRecursive(folder as ImportedFolder)

      // Create environments with extracted variables
      const envIds: string[] = []
      for (const env of environments) {
        const created = await prisma.environment.create({
          data: {
            name: env.name,
            description: env.description,
          },
        })
        envIds.push(created.id)

        for (const v of env.variables) {
          await prisma.environmentVariable.create({
            data: {
              environmentId: created.id,
              key: v.key,
              value: v.value,
              description: v.description,
              type: v.type,
              isSecret: v.isSecret,
            },
          })
        }
      }

      return { data: { success: true, folderId, environmentIds: envIds } }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to import Hoppscotch collection' }
    }
  })

  // Import cURL command
  fastify.post<{ Body: { curl: string; folderId?: string } }>('/api/import/curl', async (request) => {
    try {
      const parsed = parseCurl(request.body.curl)

      let folderId = request.body.folderId
      if (!folderId) {
        const folder = await prisma.folder.create({
          data: { name: 'Imported from cURL' },
        })
        folderId = folder.id
      }

      const req = await prisma.request.create({
        data: {
          name: parsed.url.split('/').pop() || 'Imported Request',
          method: parsed.method,
          url: parsed.url,
          headers: stringifyJson(parsed.headers),
          bodyType: parsed.bodyType,
          body: parsed.body || '',
          authType: parsed.authType,
          authConfig: stringifyJson(parsed.authConfig),
          folderId,
        },
      })

      return { data: { success: true, requestId: req.id, folderId } }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to parse cURL command' }
    }
  })

  // Import OpenAPI spec
  fastify.post<{ Body: { spec: unknown } }>('/api/import/openapi', async (request) => {
    try {
      const { folders, environments } = importOpenAPI(request.body.spec as string | object)

      const folderIds: string[] = []
      for (const folder of folders) {
        const id = await createFolderRecursive(folder as ImportedFolder)
        folderIds.push(id)
      }

      const envIds: string[] = []
      for (const env of environments) {
        const created = await prisma.environment.create({
          data: {
            name: env.name,
            description: env.description,
          },
        })
        envIds.push(created.id)

        for (const v of env.variables) {
          await prisma.environmentVariable.create({
            data: {
              environmentId: created.id,
              key: v.key,
              value: v.value,
              description: v.description,
              type: v.type,
              isSecret: v.isSecret,
            },
          })
        }
      }

      return { data: { success: true, folderIds, environmentIds: envIds } }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to import OpenAPI spec' }
    }
  })

  // Export folder as OpenAPI
  fastify.get<{ Params: { id: string } }>('/api/export/openapi/:id', async (request) => {
    try {
      const folder = await prisma.folder.findUnique({
        where: { id: request.params.id },
        include: {
          requests: true,
          children: {
            include: {
              requests: true,
              children: {
                include: {
                  requests: true,
                },
              },
            },
          },
        },
      })

      if (!folder) {
        return { error: 'Folder not found' }
      }

      type FolderType = typeof folder

      const convertFolder = (f: FolderType): ImportedFolder => ({
        name: f.name,
        description: f.description,
        headers: JSON.parse(f.headers),
        queryParams: JSON.parse(f.queryParams),
        authType: f.authType,
        authConfig: JSON.parse(f.authConfig),
        preScript: f.preScript,
        postScript: f.postScript,
        baseUrl: f.baseUrl,
        children: (f.children || []).map((c) => convertFolder(c as FolderType)),
        requests: (f.requests || []).map((r) => ({
          name: r.name,
          description: r.description,
          method: r.method,
          url: r.url,
          headers: JSON.parse(r.headers),
          queryParams: JSON.parse(r.queryParams),
          bodyType: r.bodyType,
          body: r.body,
          authType: r.authType,
          authConfig: JSON.parse(r.authConfig),
          preScript: r.preScript,
          postScript: r.postScript,
        })),
      })

      const environments = await prisma.environment.findMany({
        include: { variables: true },
      })

      const spec = exportOpenAPI(
        [convertFolder(folder) as Parameters<typeof exportOpenAPI>[0][0]],
        environments.map((e) => ({
          name: e.name,
          description: e.description,
          variables: e.variables.map((v) => ({
            key: v.key,
            value: v.value,
            description: v.description,
            type: v.type as 'string' | 'secret',
            isSecret: v.isSecret,
          })),
        })),
        { title: folder.name, description: folder.description }
      )

      return { data: spec }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to export as OpenAPI' }
    }
  })

  // Export request as cURL
  fastify.get<{ Params: { id: string } }>('/api/export/curl/:id', async (request) => {
    try {
      const req = await prisma.request.findUnique({
        where: { id: request.params.id },
      })

      if (!req) {
        return { error: 'Request not found' }
      }

      const curl = toCurl(
        req.method,
        req.url,
        JSON.parse(req.headers) as KeyValueItem[],
        req.body || null,
        req.authType as AuthType,
        JSON.parse(req.authConfig) as AuthConfig
      )

      return { data: { curl } }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to export as cURL' }
    }
  })
}
