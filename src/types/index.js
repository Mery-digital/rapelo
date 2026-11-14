/**
 * @fileoverview Modèles de données, constantes métier et types de l'application mobile RAPELO.
 */

export const REPAIR_STATUS = {
  EN_COURS: 'en_cours',
  PRET: 'pret',
  LIVRE: 'livre',
};

export const RETARD_SEUIL_JOURS = 7;

export const REPAIR_STATUS_META = {
  [REPAIR_STATUS.EN_COURS]: {
    key: 'en_cours',
    label: 'Sur le banc',
    shortLabel: 'En cours',
    icon: 'construct',
    colorKey: 'accent',
  },
  [REPAIR_STATUS.PRET]: {
    key: 'pret',
    label: 'Prêt à livrer',
    shortLabel: 'Prêt',
    icon: 'checkmark-circle',
    colorKey: 'whatsapp',
  },
  [REPAIR_STATUS.LIVRE]: {
    key: 'livre',
    label: 'Remis client',
    shortLabel: 'Livré',
    icon: 'bag-check',
    colorKey: 'muted',
  },
};

export const COUNTRY_DIAL_CODES = [
  { code: '225', flag: '🇨🇮', country: "Côte d'Ivoire", keepZero: true },
  { code: '221', flag: '🇸🇳', country: 'Sénégal' },
  { code: '223', flag: '🇲🇱', country: 'Mali' },
  { code: '226', flag: '🇧🇫', country: 'Burkina Faso' },
  { code: '237', flag: '🇨🇲', country: 'Cameroun' },
  { code: '228', flag: '🇹🇬', country: 'Togo' },
  { code: '229', flag: '🇧🇯', country: 'Bénin' },
  { code: '224', flag: '🇬🇳', country: 'Guinée' },
  { code: '227', flag: '🇳🇪', country: 'Niger' },
  { code: '241', flag: '🇬🇦', country: 'Gabon' },
  { code: '242', flag: '🇨🇬', country: 'Congo' },
  { code: '243', flag: '🇨🇩', country: 'RD Congo' },
  { code: '212', flag: '🇲🇦', country: 'Maroc' },
  { code: '216', flag: '🇹🇳', country: 'Tunisie' },
  { code: '213', flag: '🇩🇿', country: 'Algérie' },
  { code: '33', flag: '🇫🇷', country: 'France' },
];

/**
 * @typedef {Object} WorkshopProfile
 * @property {string} phone - Numéro de téléphone principal de l'atelier
 * @property {string} atelierNom - Nom commercial de l'atelier
 * @property {string} localisation - Ville / Quartier / Adresse
 * @property {string} indicatif - Indicatif téléphonique pays (ex: '225')
 * @property {string} passwordHash - Empreinte SHA-256 du mot de passe administrateur
 */

/**
 * @typedef {Object} RepairItem
 * @property {string} id - Identifiant unique de la fiche
 * @property {string} client_nom - Nom complet du client
 * @property {string} client_tel - Numéro de téléphone du client
 * @property {string} appareil - Marque et modèle de l'appareil
 * @property {string} panne_declaree - Description du problème / intervention
 * @property {number} prix_estime - Coût total estimé (en FCFA)
 * @property {number} avance_payee - Acompte déjà versé par le client (en FCFA)
 * @property {string|null} photo_url - URI de la photo de l'appareil
 * @property {'en_cours'|'pret'|'livre'} statut - Statut actuel de la réparation
 * @property {string} atelier_tel - Téléphone de l'atelier rattaché
 * @property {string} atelier_nom - Nom de l'atelier rattaché
 * @property {string} created_at - Date ISO de création du dépôt
 */

/**
 * @typedef {Object} DashboardKPIs
 * @property {number} totalCount - Nombre total de fiches
 * @property {number} enCoursCount - Appareils actuellement sur le banc
 * @property {number} pretsCount - Appareils réparés prêts à être récupérés
 * @property {number} livresCount - Appareils déjà remis aux clients
 * @property {number} retardsCount - Appareils en attente depuis plus de 7 jours
 * @property {number} totalChiffreAffaires - Volume total d'affaires (FCFA)
 * @property {number} totalEncaisse - Total des acomptes et paiements reçus (FCFA)
 * @property {number} totalResteAPayer - Solde restant à percevoir (FCFA)
 */
