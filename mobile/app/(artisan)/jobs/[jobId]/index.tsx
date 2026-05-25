import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';

import api from '../../../../services/api';
import { colors, typography, spacing, radius } from '../../../../src/theme';

export default function JobDetailBid() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidPrice, setBidPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/jobs/${jobId}`).then((res: { data: Record<string, unknown> }) => {
      setJob(res.data);
      setLoading(false);
    });
  }, [jobId]);

  const handleBid = async () => {
    if (!bidPrice) {
      Alert.alert('Error', 'Please enter your proposed price');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/bids/jobs/${jobId}`, {
        proposed_price: parseInt(bidPrice, 10),
        message,
      });
      router.replace(`/(artisan)/jobs/${jobId}/bid-sent`);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.description}>{job.description}</Text>

      {job.images && job.images.length > 0 && (
        <ScrollView horizontal style={styles.imageList}>
          {job.images.map((img: string, i: number) => (
            <Image key={i} source={{ uri: img }} style={styles.jobImage} />
          ))}
        </ScrollView>
      )}

      <View style={styles.bidForm}>
        <Text style={styles.sectionTitle}>Submit your bid</Text>
        <TextInput
          style={styles.input}
          placeholder="Proposed Price (RWF)"
          keyboardType="number-pad"
          value={bidPrice}
          onChangeText={setBidPrice}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Message to client (Optional)"
          multiline
          value={message}
          onChangeText={setMessage}
        />
        <TouchableOpacity style={styles.button} onPress={handleBid} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Submit Bid</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.bg, flexGrow: 1 },
  title: { ...typography.heading, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  imageList: { flexDirection: 'row', marginBottom: spacing.xl },
  jobImage: { width: 200, height: 150, borderRadius: radius.md, marginRight: spacing.md },
  bidForm: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { ...typography.subheading, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.bg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.md,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonText: { ...typography.subheading, color: colors.surface },
});
