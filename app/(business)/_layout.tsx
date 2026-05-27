import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View className={`items-center justify-center w-10 h-10 rounded-2xl ${focused ? 'bg-primary-100' : 'bg-transparent'}`}>
      <Text className="text-2xl">{emoji}</Text>
    </View>
  );
}

export default function BusinessLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6C3DF4',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          backgroundColor: '#FFFFFF',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campañas',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ focused }) => (
            <View className="w-14 h-14 bg-primary-500 rounded-2xl items-center justify-center -mt-4 shadow-lg" style={{ elevation: 6 }}>
              <Text className="text-2xl">📷</Text>
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi negocio',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
