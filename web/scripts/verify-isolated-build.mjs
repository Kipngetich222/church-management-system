import assert from 'node:assert/strict'
import {
  cpSync,
  constants,
  existsSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const webRoot = fileURLToPath(new URL('../', import.meta.url))
const repositoryRoot = path.resolve(webRoot, '..')
const temporaryParent = realpathSync(tmpdir())
const isolatedRoot = mkdtempSync(
  path.join(temporaryParent, 'church-web-build-')
)
const isolatedWeb = path.join(isolatedRoot, 'web')
const isolatedDependencies = path.join(isolatedWeb, 'node_modules')

try {
  assert(
    existsSync(path.join(webRoot, 'node_modules/next/dist/bin/next')),
    'Install the web dependencies before running build:isolated'
  )
  // Preserve the deployment's source layout and workspace detection, without
  // its backend node_modules or any cached Next.js build output.
  for (const filename of ['package.json', 'package-lock.json']) {
    cpSync(
      path.join(repositoryRoot, filename),
      path.join(isolatedRoot, filename)
    )
  }
  cpSync(path.join(repositoryRoot, 'src'), path.join(isolatedRoot, 'src'), {
    recursive: true,
  })
  const excluded = new Set([
    'node_modules',
    '.next',
    '.vercel',
    '.git',
    'out',
    'build',
  ])
  cpSync(webRoot, isolatedWeb, {
    recursive: true,
    filter: (source) =>
      !excluded.has(path.basename(source)) && !source.endsWith('.tsbuildinfo'),
  })
  console.log(
    'Copying the web dependencies into a fresh temporary workspace; backend dependencies are excluded.'
  )
  cpSync(path.join(webRoot, 'node_modules'), isolatedDependencies, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    verbatimSymlinks: true,
  })
  assert(
    !existsSync(path.join(isolatedRoot, 'node_modules')),
    'The isolated workspace must not have backend dependencies'
  )
  assert(
    !existsSync(path.join(isolatedWeb, '.next')),
    'The isolated build must start without Next.js output'
  )
  assert(
    !existsSync(path.join(isolatedWeb, 'tsconfig.tsbuildinfo')),
    'The isolated build must start without a TypeScript cache'
  )
  console.log(
    'Building a fresh temporary workspace with only web/node_modules available.'
  )

  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(isolatedDependencies, 'next/dist/bin/next'), 'build'],
      {
        cwd: isolatedWeb,
        stdio: 'inherit',
        env: { ...process.env, NODE_PATH: '', NEXT_TELEMETRY_DISABLED: '1' },
      }
    )
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
  })
  process.exitCode = code
} finally {
  // Validate the absolute target before recursive cleanup. Never delete the
  // real installation, or leave copied local env files behind.
  const resolved = realpathSync(isolatedRoot)
  assert.equal(path.dirname(resolved), temporaryParent)
  assert(path.basename(resolved).startsWith('church-web-build-'))
  rmSync(resolved, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 250,
  })
}
