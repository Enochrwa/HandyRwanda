import { Home, Search, MessageCircle, User, LayoutDashboard } from '@icons';
import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';

import { useAuthStore } from '../../src/store/authStore';

export default function TabsLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  const isArtisan = user?.role === 'artisan';

  return (
    <Tabs
      screenOptions={{
        lazy: true,
        headerShown: true,
        tabBarActiveTintColor: '#1B5E3B',
        tabBarInactiveTintColor: '#6B6B6B',
        tabBarStyle: { borderTopColor: '#E2E8F0' },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: '700', color: '#1A1A1A' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HandyRwanda',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
          headerRight: () =>
            !isAuthenticated ? (
              <TouchableOpacity
                accessibilityLabel="Log in"
                onPress={() => router.push('/auth')}
                className="mr-4 px-3 py-1.5 bg-primary rounded-full"
              >
                <Text className="text-white text-xs font-bold">Log in</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Find Artisans',
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => <Search color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} />,
          href: isAuthenticated ? undefined : null,
        }}
      />
      {/* Pro dashboard — always declared, hidden unless artisan */}
      <Tabs.Screen
        name="pro"
        options={{
          title: 'Pro Dashboard',
          tabBarLabel: 'Pro',
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} />,
          href: isAuthenticated && isArtisan ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
          href: isAuthenticated ? undefined : null,
        }}
      />
    </Tabs>
  );
}
