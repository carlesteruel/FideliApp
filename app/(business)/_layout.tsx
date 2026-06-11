import { Tabs } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, size = 24 }: { name: IoniconName; focused: boolean; size?: number }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: focused ? `${colors.primary500}18` : 'transparent',
      }}
    >
      <Ionicons
        name={focused ? name : (`${name}-outline` as IoniconName)}
        size={size}
        color={focused ? colors.primary500 : colors.gray400}
      />
    </View>
  );
}

function CenterTabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 62,
        height: 62,
        borderRadius: 20,
        backgroundColor: focused ? colors.primary600 : colors.primary500,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -18,
        shadowColor: colors.primary500,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 10,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.85)',
      }}
    >
      <Ionicons name="scan" size={28} color="#fff" />
    </View>
  );
}

export default function BusinessLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary500,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          height: 84,
          paddingBottom: 16,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          backgroundColor: '#FFFFFF',
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campañas',
          tabBarIcon: ({ focused }) => <TabIcon name="megaphone" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ focused }) => <CenterTabIcon focused={focused} />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi negocio',
          tabBarIcon: ({ focused }) => <TabIcon name="storefront" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
