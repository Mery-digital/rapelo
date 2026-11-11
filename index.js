import { registerRootComponent } from 'expo';
import { Alert, Platform } from 'react-native';
import App from './App';

// react-native-web's Alert.alert does nothing: use the browser dialogs instead.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    const confirmBtn = buttons.find((b) => b !== cancel) || buttons[buttons.length - 1];
    if (window.confirm(`${text}\n\nOK = ${confirmBtn.text}`)) {
      confirmBtn.onPress?.();
    } else {
      cancel?.onPress?.();
    }
  };
}

registerRootComponent(App);
