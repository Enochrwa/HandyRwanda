import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { Home, Search, MessageCircle, User, LayoutDashboard } from 'lucide-react-native';

export default function TabsLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#1B5E3B',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Home color={color} size={22} />
          ),
          headerRight: () =>
            !isAuthenticated ? (
              <TouchableOpacity
                accessibilityLabel="Tab Item"
                onPress={() => router.push('/auth')}
                className="mr-4 px-3 py-1 bg-primary rounded-full"
              >
                <Text className="text-white text-xs font-bold">Log in</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <Search color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => (
            <MessageCircle color={color} size={22} />
          ),
          href: isAuthenticated ? undefined : null,
        }}
      />
      {user?.role === 'artisan' && (
        <Tabs.Screen
          name="pro"
          options={{
            title: 'Pro',
            tabBarIcon: ({ color }) => (
              <LayoutDashboard color={color} size={22} />
            ),
            href: isAuthenticated ? undefined : null,
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <User color={color} size={22} />
          ),
          href: isAuthenticated ? undefined : null,
        }}
      />
    </Tabs>
  );
}
