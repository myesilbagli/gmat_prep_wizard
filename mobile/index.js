import { registerRootComponent } from 'expo'
import Constants from 'expo-constants'
import App from './src/App'

// Physical device + Expo Go can hard-crash (JSI HostFunction) when requiring gesture-handler.
// Only require gesture-handler in dev-client / store builds.
if (Constants.appOwnership !== 'expo') {
  require('react-native-gesture-handler')
}

registerRootComponent(App)
