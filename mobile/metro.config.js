const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)
config.watchFolders = [workspaceRoot]
// Mobile workspace deps live under mobile/node_modules; root hoisting may omit them.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true
config.resolver.extraNodeModules = {
  'react-native-safe-area-context': path.resolve(
    workspaceRoot,
    'node_modules/react-native-safe-area-context',
  ),
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
}

/** Expo Go has no native IAP — use JS mock in development unless disabled. Store builds always use the real native module. */
function resolveIapUseMock() {
  if (process.env.NODE_ENV === 'production') return false
  const v = process.env.EXPO_PUBLIC_IAP_USE_MOCK
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return true
}

const mockPurchasesPath = path.resolve(projectRoot, 'src/lib/iap/purchasesMock.ts')
const { resolveRequest: upstreamResolve } = config.resolver

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-purchases' && resolveIapUseMock()) {
    return { type: 'sourceFile', filePath: mockPurchasesPath }
  }
  if (upstreamResolve) {
    return upstreamResolve(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
