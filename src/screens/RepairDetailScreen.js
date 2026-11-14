import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Button from '../components/Button';
import {
  HeroCard,
  HeroChip,
  HeroCloseButton,
  HeroDialog,
  HeroSeparator,
  HeroSurface,
  useToast,
} from '../components/HeroUI';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '../context/NavigationContext';
import { radius, shadowSoft } from '../theme';
import {
  formatPrice,
  formatDate,
  daysSince,
  computeBalance,
  callCustomer,
  openWhatsApp,
  openSms,
  readyMessage,
  unrepairedMessage,
  reminderMessage,
} from '../lib/messaging';
import { updateRepairStatus, deleteRepair } from '../lib/repairs';

export default function RepairDetailScreen({
  atelier,
  fiche: initialFiche,
  onUpdated,
  onRemoved,
  onEdit,
}) {
  const { theme, isDark } = useTheme();
  const { goBack } = useNavigation();
  const { showToast } = useToast();

  const [fiche, setFiche] = useState(initialFiche);
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { total, paid, reste } = computeBalance(
    fiche.prix_estime ?? fiche.prix,
    fiche.avance_payee ?? fiche.avance
  );
  const days = daysSince(fiche.created_at);
  const isDelivered = fiche.statut === 'livre';

  const STATUS_LIST = [
    { id: 'en_cours', label: 'En réparation', icon: 'construct', color: theme.accent },
    { id: 'pret', label: 'Prêt à livrer', icon: 'checkmark-circle', color: theme.whatsapp },
    { id: 'non_repare', label: 'Non réparé', icon: 'close-circle', color: theme.danger },
    { id: 'livre', label: 'Remis au client', icon: 'bag-check', color: theme.muted },
  ];

  const handleStatusChange = async (newStatut) => {
    if (fiche.statut === newStatut) return;
    Haptics.selectionAsync().catch(() => {});
    setUpdatingStatus(true);
    try {
      const updated = await updateRepairStatus(fiche.id, newStatut);
      setFiche(updated);
      onUpdated?.(updated);
      showToast({
        title: 'Statut actualisé',
        message: `${updated.appareil} est maintenant : ${newStatut}`,
        type: 'success',
      });
    } catch (e) {
      Alert.alert('Erreur', e?.message || 'Impossible de mettre à jour le statut.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDialog(null);
    try {
      await deleteRepair(fiche.id);
      onRemoved?.(fiche.id);
      showToast({
        title: 'Fiche supprimée',
        message: `${fiche.appareil} a été retiré.`,
        type: 'danger',
      });
      goBack();
    } catch (e) {
      Alert.alert('Erreur', e?.message || 'Impossible de supprimer.');
    }
  };

  const handleSendMessage = (channel, outcome) => {
    let msg = '';
    if (outcome === 'ready') msg = readyMessage(fiche, atelier);
    else if (outcome === 'unrepaired') msg = unrepairedMessage(fiche, atelier);
    else if (outcome === 'reminder') msg = reminderMessage(fiche, atelier);

    if (channel === 'whatsapp') {
      openWhatsApp(fiche.client_tel, msg, atelier.indicatif);
    } else {
      openSms(fiche.client_tel, msg);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* 1. TOP HEADER AVEC RETOUR */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Button
          size="sm"
          variant="tertiary"
          isIconOnly
          accessibilityLabel="Retour"
          onPress={goBack}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Button>

        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {fiche.appareil}
          </Text>
          <Text style={[styles.headerSub, { color: theme.muted }]}>
            Déposé {days === 0 ? 'Aujourd’hui' : `il y a ${days} j`} · {formatDate(fiche.created_at)}
          </Text>
        </View>

        {onEdit ? (
          <Button
            size="sm"
            variant="outline"
            icon="pencil"
            title="Modifier"
            onPress={() => onEdit(fiche)}
          />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 2. PHOTO DE L'APPAREIL */}
        {fiche.photo_url ? (
          <Pressable onPress={() => setPhotoZoomOpen(true)} style={styles.photoWrap}>
            <Image source={{ uri: fiche.photo_url }} style={styles.photoImg} resizeMode="cover" />
            <View style={styles.zoomBadge}>
              <Ionicons name="expand" size={14} color="#FFFFFF" />
              <Text style={styles.zoomBadgeText}>Toucher pour agrandir</Text>
            </View>
          </Pressable>
        ) : null}

        {/* 3. SÉLECTEUR DE STATUT DE RÉPARATION */}
        <HeroCard style={styles.sectionCard}>
          <HeroCard.Header>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              ÉTAT D’AVANCEMENT :
            </Text>
          </HeroCard.Header>
          <HeroCard.Body style={styles.statusChipsRow}>
            {STATUS_LIST.map((st) => {
              const active = fiche.statut === st.id;
              return (
                <Pressable
                  key={st.id}
                  onPress={() => handleStatusChange(st.id)}
                  disabled={updatingStatus}
                >
                  <HeroChip
                    icon={st.icon}
                    label={st.label}
                    color={st.color}
                    variant={active ? 'solid' : 'flat'}
                    size="md"
                    style={styles.statusChipItem}
                  />
                </Pressable>
              );
            })}
          </HeroCard.Body>
        </HeroCard>

        {/* 4. CLIENT & CONTACT */}
        <HeroCard style={styles.sectionCard}>
          <HeroCard.Header>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              PROPRIÉTAIRE :
            </Text>
          </HeroCard.Header>
          <HeroCard.Body>
            <View style={styles.clientRow}>
              <View style={[styles.clientAvatar, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="person" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clientName, { color: theme.text }]}>
                  {fiche.client_nom}
                </Text>
                <Text style={[styles.clientPhone, { color: theme.textSecondary }]}>
                  {fiche.client_tel}
                </Text>
              </View>

              <Button
                size="sm"
                variant="whatsapp"
                icon="call"
                title="Appeler"
                onPress={() => callCustomer(fiche.client_tel)}
              />
            </View>
          </HeroCard.Body>
        </HeroCard>

        {/* 5. DIAGNOSTIC */}
        <HeroCard style={styles.sectionCard}>
          <HeroCard.Header>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              DIAGNOSTIC & PANNE SIGNALÉE :
            </Text>
          </HeroCard.Header>
          <HeroCard.Body>
            <HeroSurface style={styles.problemBox}>
              <Ionicons name="construct" size={18} color={theme.accent} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.problemText, { color: theme.text }]}>
                {fiche.probleme}
              </Text>
            </HeroSurface>
          </HeroCard.Body>
        </HeroCard>

        {/* 6. FINANCES & SOLDE */}
        <HeroCard style={styles.sectionCard}>
          <HeroCard.Header>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              BILAN FINANCIER :
            </Text>
          </HeroCard.Header>
          <HeroCard.Body>
            <View style={[styles.financeGrid, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.financeCol}>
                <Text style={[styles.financeLabel, { color: theme.muted }]}>Prix total</Text>
                <Text style={[styles.financeVal, { color: theme.accent }]}>{formatPrice(total)}</Text>
              </View>
              <View style={[styles.financeDivider, { backgroundColor: theme.border }]} />
              <View style={styles.financeCol}>
                <Text style={[styles.financeLabel, { color: theme.muted }]}>Acompte reçu</Text>
                <Text style={[styles.financeVal, { color: theme.whatsapp }]}>{formatPrice(paid)}</Text>
              </View>
              <View style={[styles.financeDivider, { backgroundColor: theme.border }]} />
              <View style={styles.financeCol}>
                <Text style={[styles.financeLabel, { color: theme.muted }]}>Reste à payer</Text>
                <Text
                  style={[
                    styles.financeVal,
                    { color: total > 0 && reste === 0 ? theme.whatsapp : theme.danger },
                  ]}
                >
                  {total > 0 && reste === 0 ? 'Soldé' : formatPrice(reste)}
                </Text>
              </View>
            </View>
          </HeroCard.Body>
        </HeroCard>

        {/* 7. ENVOI RAPIDE WHATSAPP & SMS */}
        <HeroCard style={styles.sectionCard}>
          <HeroCard.Header>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              PRÉVENIR LE CLIENT :
            </Text>
          </HeroCard.Header>
          <HeroCard.Body>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <Button
                size="sm"
                variant="whatsapp"
                icon="logo-whatsapp"
                title="WhatsApp (Prêt)"
                feedbackVariant="scale-ripple"
                onPress={() => handleSendMessage('whatsapp', 'ready')}
              />
              <Button
                size="sm"
                variant="sms"
                icon="chatbubble-ellipses"
                title="SMS Direct"
                feedbackVariant="scale-ripple"
                onPress={() => handleSendMessage('sms', 'ready')}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                size="sm"
                variant="tertiary"
                icon="notifications-outline"
                title="Relance client"
                onPress={() => handleSendMessage('whatsapp', 'reminder')}
              />
              <Button
                size="sm"
                variant="danger-soft"
                icon="close-circle-outline"
                title="Non réparé"
                onPress={() => handleSendMessage('whatsapp', 'unrepaired')}
              />
            </View>
          </HeroCard.Body>
        </HeroCard>

        {/* 8. ACTIONS FINALES */}
        <View style={styles.bottomActions}>
          <Button
            size="md"
            variant={isDelivered ? 'secondary' : 'primary'}
            icon={isDelivered ? 'bag-check' : 'checkmark-done-circle'}
            title={
              isDelivered
                ? 'Appareil déjà remis (Remettre en cours)'
                : 'Le client a récupéré son appareil'
            }
            onPress={() => handleStatusChange(isDelivered ? 'en_cours' : 'livre')}
          />

          <View style={{ height: 12 }} />

          <Button
            size="sm"
            variant="ghost"
            icon="trash-outline"
            title="Supprimer définitivement cette fiche"
            onPress={() => setConfirmDialog(true)}
          />
        </View>
      </ScrollView>

      {/* Confirmation Dialog */}
      <HeroDialog
        visible={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(false)}
        icon="trash"
        iconColor={theme.danger}
        iconBg={theme.dangerSoft}
        title="Supprimer la fiche ?"
        description={`La fiche de ${fiche.client_nom} (${fiche.appareil}) sera définitivement supprimée.`}
      >
        <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
          <Button
            size="sm"
            title="Annuler"
            variant="tertiary"
            onPress={() => setConfirmDialog(false)}
          />
          <Button
            size="sm"
            variant="danger"
            title="Oui, supprimer"
            onPress={handleDelete}
          />
        </View>
      </HeroDialog>

      {/* Photo Viewer Modal */}
      {fiche.photo_url ? (
        <Modal
          visible={photoZoomOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoZoomOpen(false)}
        >
          <Pressable style={styles.zoomModalBg} onPress={() => setPhotoZoomOpen(false)}>
            <View style={styles.zoomModalCard}>
              <HeroCloseButton
                variant="overlay"
                size="lg"
                accessibilityLabel="Fermer"
                onPress={() => setPhotoZoomOpen(false)}
                style={{ alignSelf: 'flex-end', marginBottom: 10 }}
              />
              <Image source={{ uri: fiche.photo_url }} style={styles.zoomModalImg} resizeMode="contain" />
              <Text style={styles.zoomModalCaption}>{fiche.appareil} · {fiche.client_nom}</Text>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  photoWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: 220,
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  zoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChipItem: {
    marginRight: 6,
    marginBottom: 6,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '900',
  },
  clientPhone: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  problemBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  problemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  financeGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  financeCol: {
    flex: 1,
    alignItems: 'center',
  },
  financeDivider: {
    width: 1,
    height: 28,
  },
  financeLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  financeVal: {
    fontSize: 14,
    fontWeight: '900',
  },
  bottomActions: {
    marginTop: 10,
    marginBottom: 20,
  },
  zoomModalBg: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  zoomModalCard: {
    width: '100%',
    alignItems: 'center',
  },
  zoomModalImg: {
    width: '100%',
    height: 420,
    borderRadius: radius.lg,
  },
  zoomModalCaption: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
  },
});
