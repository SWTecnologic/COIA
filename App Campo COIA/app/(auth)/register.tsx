import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { UserPlus, ArrowLeft } from 'lucide-react-native';

export default function Register() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <UserPlus size={64} color="#7C3AED" />
        </View>

        <Text style={styles.title}>Acesso Restrito</Text>
        <Text style={styles.description}>
          Os técnicos de campo não podem criar conta por conta própria.
        </Text>
        <Text style={styles.description}>
          Fale com seu supervisor para criar seu acesso no sistema.
        </Text>

        <Link href="/(auth)/login" style={styles.backLink}>
          <View style={styles.backButton}>
            <ArrowLeft size={20} color="#7C3AED" />
            <Text style={styles.backButtonText}>Voltar para o login</Text>
          </View>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  backLink: {
    marginTop: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
