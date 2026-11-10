import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

const webRoot = fileURLToPath(new URL('../', import.meta.url))
const repositoryRoot = path.resolve(webRoot, '..')
const backendDependencies = path.join(repositoryRoot, 'node_modules')
const isBackendDependency = (filename) => {
  const relative = path.relative(backendDependencies, filename)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

test('shared communication types resolve using only the web dependency installation', () => {
  const configFile = ts.readConfigFile(
    path.join(webRoot, 'tsconfig.json'),
    ts.sys.readFile
  )
  assert.equal(configFile.error, undefined)
  const config = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    webRoot
  )
  assert.deepEqual(config.errors, [])

  // Vercel installs in web/. Hide the backend installation that would otherwise
  // make a local build pass even when the deployment cannot resolve this import.
  const host = {
    ...ts.sys,
    fileExists: (filename) =>
      !isBackendDependency(filename) && ts.sys.fileExists(filename),
    directoryExists: (dirname) =>
      !isBackendDependency(dirname) && ts.sys.directoryExists(dirname),
  }
  const sharedModule = path.join(
    repositoryRoot,
    'src/modules/messages/communication-engine.ts'
  )
  const resolved = ts.resolveModuleName(
    '@supabase/supabase-js',
    sharedModule,
    config.options,
    host
  ).resolvedModule

  assert.ok(
    resolved,
    'Shared communication code must resolve Supabase without root/node_modules'
  )
  const webDependencies = path.join(webRoot, 'node_modules')
  const relative = path.relative(webDependencies, resolved.resolvedFileName)
  assert(
    !relative.startsWith('..') && !path.isAbsolute(relative),
    'Supabase must resolve from the web app’s dependency installation'
  )
})
