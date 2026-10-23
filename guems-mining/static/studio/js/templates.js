// Bibliothèque de modèles vidéo. Chaque modèle est un plan (voir builder.js) entièrement personnalisable :
// textes, couleurs, polices, durée, format, logo, images/vidéos et musique.

export const CATEGORIES = {
  ads: 'Publicités commerciales',
  social: 'Réseaux sociaux (Facebook, Instagram, TikTok)',
  promo: 'Vidéos promotionnelles d\'entreprise',
  product: 'Présentations de produits',
  music: 'Clips musicaux',
  realestate: 'Vidéos immobilières',
  training: 'Vidéos de formation',
  corporate: 'Présentations institutionnelles',
  intro: 'Intros et outros animées',
  kinetic: 'Typographie cinétique',
  motion: 'Motion design corporate',
  logo: 'Logos animés',
  story: 'Storytelling',
  event: 'Vidéos événementielles',
};

const P = (background, primary, accent, text = '#FFFFFF') => ({ background, primary, accent, text });
const S = (duration, visual, headline, subtext = '', textAnimation = 'slide-up', transition = 'fade', effects = [], camera = 'static') => ({ duration, visual, headline, subtext, textAnimation, transition, effects, camera });

export const TEMPLATES = [
  {
    id: 'ad-cinematic-30', category: 'ads', name: 'Publicité cinématique 30 s', description: 'Logo animé, trois messages forts sur vos images et appel à l\'action final.',
    plan: { aspect: '16:9', style: { palette: P('#0B0B0C', '#F96A00', '#FFB15C'), fontHeading: 'Manrope', fontBody: 'Inter', mood: 'cinématique', effects: ['vignette', 'grain', 'letterbox', 'color-grade-warm'] },
      music: { mood: 'épique, montée progressive', bpm: 100 },
      scenes: [S(4, 'logo', 'VOTRE MARQUE', 'Votre slogan ici', 'tracking', 'fade-black'), S(6, 'media', 'Un savoir-faire reconnu', 'Présentez votre force principale', 'mask-up', 'fade', [], 'slow-zoom-in'), S(6, 'media', 'Des équipes engagées', 'Votre deuxième argument', 'mask-up', 'whip-pan', [], 'pan-left'), S(6, 'media', 'Des résultats concrets', 'Votre troisième argument', 'mask-up', 'fade', [], 'push-in'), S(8, 'cta', 'Parlons de votre projet', '+000 00 00 00 00', 'pop', 'circle', ['glow'])] },
  },
  {
    id: 'ad-flash-15', category: 'ads', name: 'Spot promotionnel 15 s', description: 'Format court et rythmé pour une offre ou un lancement.',
    plan: { aspect: '16:9', style: { palette: P('#111111', '#E8202A', '#FFD23F'), fontHeading: 'Anton', fontBody: 'Inter', mood: 'énergique', effects: ['vignette'] },
      scenes: [S(3, 'kinetic', 'OFFRE EXCEPTIONNELLE', '', 'pop', 'flash', ['flash']), S(4, 'media', '-30 % ce mois-ci', 'Sur toute la gamme', 'pop-words', 'slide-left', [], 'slow-zoom-in'), S(4, 'media', 'Livraison rapide', 'Partout dans le pays', 'pop-words', 'slide-left'), S(4, 'cta', 'Commandez maintenant', 'www.votre-site.com', 'pop', 'zoom-in', ['glow'])] },
  },
  {
    id: 'social-tiktok', category: 'social', name: 'TikTok / Reels dynamique', description: 'Vertical 9:16, accroche immédiate, textes mot par mot.',
    plan: { aspect: '9:16', style: { palette: P('#0D0D12', '#FF3D7F', '#36E2F5'), fontHeading: 'Bebas Neue', fontBody: 'Poppins', mood: 'tendance', effects: ['particles-sparks'] },
      scenes: [S(2.5, 'kinetic', 'ATTENDEZ DE VOIR ÇA', '', 'pop', 'glitch', ['chromatic']), S(4, 'media', 'Étape 1', 'Décrivez la première étape', 'words', 'slide-up', [], 'push-in'), S(4, 'media', 'Étape 2', 'Décrivez la deuxième étape', 'words', 'slide-up', [], 'push-in'), S(4, 'media', 'Le résultat', 'Montrez la transformation', 'pop-words', 'zoom-in', ['glow'], 'slow-zoom-out'), S(3, 'cta', 'Abonnez-vous', '@votre_compte', 'pop', 'flash')] },
  },
  {
    id: 'social-instagram-square', category: 'social', name: 'Publication Instagram carrée', description: 'Format 1:1 élégant pour le fil d\'actualité.',
    plan: { aspect: '1:1', style: { palette: P('#F4EFE6', '#1F3D2B', '#C8A45D', '#1A1A1A'), fontHeading: 'Playfair Display', fontBody: 'Inter', mood: 'élégant', effects: [] },
      scenes: [S(3, 'text', 'Nouvelle collection', 'Disponible dès aujourd\'hui', 'mask-up', 'fade'), S(4, 'media', 'Pensée pour vous', '', 'fade', 'wipe-right', [], 'slow-zoom-in'), S(4, 'media', 'Fabriquée avec soin', '', 'fade', 'wipe-right', [], 'slow-zoom-in'), S(3, 'cta', 'Découvrez-la', 'Lien dans la bio', 'fade', 'fade')] },
  },
  {
    id: 'social-facebook-story', category: 'social', name: 'Story Facebook événement', description: 'Annonce verticale avec date, lieu et appel à l\'action.',
    plan: { aspect: '9:16', style: { palette: P('#101828', '#2E90FA', '#FDB022'), fontHeading: 'Montserrat', fontBody: 'Inter', mood: 'informatif', effects: ['light-leak'] },
      scenes: [S(3, 'text', 'Rendez-vous le 15 juin', 'Grande journée portes ouvertes', 'slide-up', 'fade'), S(4, 'media', 'Au programme', 'Démonstrations, ateliers, rencontres', 'words', 'slide-up', [], 'slow-zoom-in'), S(3, 'cta', 'Inscrivez-vous', 'Places limitées', 'pop', 'zoom-in')] },
  },
  {
    id: 'promo-company', category: 'promo', name: 'Présentation d\'entreprise', description: 'Qui vous êtes, ce que vous faites, pourquoi vous choisir.',
    plan: { aspect: '16:9', style: { palette: P('#0F172A', '#F96A00', '#38BDF8'), fontHeading: 'Manrope', fontBody: 'Inter', mood: 'professionnel', effects: ['vignette', 'particles-dust'] },
      scenes: [S(4, 'logo', 'Votre entreprise', 'Votre activité en une phrase', 'tracking', 'fade-black'), S(6, 'split', 'Qui sommes-nous ?', 'Une phrase qui présente votre entreprise et sa mission.', 'mask-up', 'wipe-left', [], 'slow-zoom-in'), S(6, 'lower-third', 'Nos services', 'Service 1 · Service 2 · Service 3', 'mask-up', 'fade', [], 'pan-right'), S(6, 'media', 'Pourquoi nous choisir', 'Votre engagement principal', 'mask-up', 'fade', [], 'push-in'), S(6, 'cta', 'Contactez-nous', 'contact@votre-entreprise.com', 'pop', 'circle', ['glow'])] },
  },
  {
    id: 'product-launch', category: 'product', name: 'Lancement de produit', description: 'Révélation du produit, caractéristiques clés, prix et achat.',
    plan: { aspect: '16:9', style: { palette: P('#09090B', '#A855F7', '#22D3EE'), fontHeading: 'Space Grotesk', fontBody: 'Inter', mood: 'technologique', effects: ['particles-bokeh', 'vignette'] },
      scenes: [S(3, 'kinetic', 'LE NOUVEAU PRODUIT', '', 'pop', 'flash', ['glow']), S(5, 'split', 'Caractéristique n°1', 'Expliquez l\'avantage principal.', 'slide-left', 'slide-left', [], 'slow-zoom-in'), S(5, 'split', 'Caractéristique n°2', 'Un deuxième avantage concret.', 'slide-left', 'slide-left', [], 'slow-zoom-in'), S(4, 'media', 'À partir de 99 €', '', 'pop', 'zoom-in', ['glow'], 'push-in'), S(4, 'cta', 'Disponible maintenant', 'www.votre-boutique.com', 'pop', 'fade')] },
  },
  {
    id: 'music-clip', category: 'music', name: 'Clip musical / lyrics', description: 'Paroles animées sur vos images, effets lumineux.',
    plan: { aspect: '16:9', style: { palette: P('#050507', '#FF2E88', '#7C3AED'), fontHeading: 'Bebas Neue', fontBody: 'Poppins', mood: 'nocturne', effects: ['particles-bokeh', 'grain', 'color-grade-cool'] },
      scenes: [S(4, 'text', 'NOM DE L\'ARTISTE', 'Titre du morceau', 'blur-in', 'fade-black', ['glow']), S(4, 'media', 'Première ligne des paroles', '', 'words', 'blur-dissolve', ['chromatic'], 'parallax'), S(4, 'media', 'Deuxième ligne des paroles', '', 'words', 'blur-dissolve', [], 'slow-zoom-in'), S(4, 'media', 'Troisième ligne des paroles', '', 'words', 'glitch', ['glitch'], 'shake'), S(4, 'text', 'Disponible partout', 'Plateformes de streaming', 'fade', 'fade')] },
  },
  {
    id: 'real-estate', category: 'realestate', name: 'Visite immobilière', description: 'Pièces, surfaces, prix et coordonnées de l\'agence.',
    plan: { aspect: '16:9', style: { palette: P('#1C1917', '#B45309', '#FCD34D'), fontHeading: 'DM Serif Display', fontBody: 'Inter', mood: 'chaleureux', effects: ['vignette', 'color-grade-warm'] },
      scenes: [S(4, 'media', 'Villa contemporaine', 'Quartier résidentiel · 5 pièces', 'mask-up', 'fade-black', [], 'slow-zoom-in'), S(5, 'lower-third', 'Séjour lumineux', '45 m² ouvert sur le jardin', 'mask-up', 'fade', [], 'pan-left'), S(5, 'lower-third', 'Cuisine équipée', 'Îlot central, finitions haut de gamme', 'mask-up', 'fade', [], 'pan-right'), S(5, 'lower-third', 'Suite parentale', 'Dressing et salle d\'eau', 'mask-up', 'fade', [], 'slow-zoom-out'), S(5, 'cta', 'Prix : sur demande', 'Agence · +000 00 00 00', 'fade', 'fade')] },
  },
  {
    id: 'training-module', category: 'training', name: 'Module de formation', description: 'Titre, objectifs, étapes numérotées et récapitulatif.',
    plan: { aspect: '16:9', style: { palette: P('#F8FAFC', '#2563EB', '#10B981', '#0F172A'), fontHeading: 'Poppins', fontBody: 'Inter', mood: 'pédagogique', effects: [] },
      scenes: [S(4, 'text', 'Module 1 : Les bases', 'Durée : 10 minutes', 'slide-up', 'fade'), S(5, 'text', 'Objectifs', 'Comprendre · Appliquer · Vérifier', 'words', 'wipe-left'), S(5, 'split', 'Étape 1', 'Expliquez la première étape clairement.', 'slide-left', 'slide-left'), S(5, 'split', 'Étape 2', 'Expliquez la deuxième étape.', 'slide-left', 'slide-left'), S(4, 'text', 'À retenir', 'Le point essentiel du module', 'pop', 'zoom-in')] },
  },
  {
    id: 'corporate-institutional', category: 'corporate', name: 'Présentation institutionnelle', description: 'Ton sobre, chiffres validés, valeurs et contact.',
    plan: { aspect: '16:9', style: { palette: P('#0B1220', '#C8A45D', '#E5E7EB'), fontHeading: 'Playfair Display', fontBody: 'Inter', mood: 'institutionnel', effects: ['vignette', 'particles-dust'] },
      scenes: [S(5, 'logo', 'Votre institution', 'Depuis 20XX', 'fade', 'fade-black'), S(6, 'media', 'Notre mission', 'Énoncez la mission en une phrase.', 'mask-up', 'fade', [], 'slow-zoom-in'), S(6, 'media', 'Nos valeurs', 'Valeur 1 · Valeur 2 · Valeur 3', 'mask-up', 'fade', [], 'pan-left'), S(6, 'cta', 'Nous contacter', 'www.votre-site.org', 'fade', 'fade')] },
  },
  {
    id: 'intro-channel', category: 'intro', name: 'Intro de chaîne / vidéo', description: 'Ouverture de 5 secondes avec logo et lueur.',
    plan: { aspect: '16:9', style: { palette: P('#000000', '#F96A00', '#FFD27A'), fontHeading: 'Manrope', fontBody: 'Inter', mood: 'impactant', effects: ['particles-sparks', 'light-leak'] },
      scenes: [S(2, 'kinetic', 'BIENVENUE', '', 'pop', 'flash', ['flash']), S(3, 'logo', 'Votre nom', '', 'tracking', 'zoom-in', ['glow'])] },
  },
  {
    id: 'outro-subscribe', category: 'intro', name: 'Outro / générique de fin', description: 'Remerciements, réseaux sociaux et générique.',
    plan: { aspect: '16:9', style: { palette: P('#0E0E10', '#F96A00', '#FFFFFF'), fontHeading: 'Manrope', fontBody: 'Inter', mood: 'chaleureux', effects: ['vignette'] },
      scenes: [S(3, 'text', 'Merci d\'avoir regardé', '', 'mask-up', 'fade'), S(4, 'text', 'Réalisation', 'Votre nom\nMusique : titre (licence)', 'slide-up', 'fade'), S(3, 'cta', 'Abonnez-vous', '@votre_compte', 'pop', 'fade-black')] },
  },
  {
    id: 'kinetic-manifesto', category: 'kinetic', name: 'Manifeste en typographie cinétique', description: 'Phrases percutantes animées mot par mot, sans image.',
    plan: { aspect: '9:16', style: { palette: P('#0A0A0A', '#F96A00', '#FFFFFF'), fontHeading: 'Anton', fontBody: 'Inter', mood: 'percutant', effects: ['grain'] },
      scenes: [S(3, 'kinetic', 'NOUS CROYONS AU TRAVAIL BIEN FAIT', '', 'pop', 'flash'), S(3, 'kinetic', 'À LA PAROLE DONNÉE', '', 'pop', 'glitch', ['chromatic']), S(3, 'kinetic', 'ET AUX RÉSULTATS', '', 'pop', 'flash'), S(3, 'cta', 'Rejoignez-nous', 'votre-site.com', 'pop', 'zoom-in')] },
  },
  {
    id: 'motion-corporate', category: 'motion', name: 'Motion design corporate', description: 'Formes animées, bandeaux et chiffres clés validés.',
    plan: { aspect: '16:9', style: { palette: P('#0F172A', '#14B8A6', '#F59E0B'), fontHeading: 'Space Grotesk', fontBody: 'Inter', mood: 'moderne', effects: ['particles-dust'] },
      scenes: [S(4, 'text', 'Rapport annuel', 'Les faits marquants', 'mask-up', 'wipe-diagonal'), S(4, 'lower-third', 'Chiffre clé n°1', 'À remplacer par une donnée vérifiée', 'mask-up', 'wipe-left'), S(4, 'lower-third', 'Chiffre clé n°2', 'À remplacer par une donnée vérifiée', 'mask-up', 'wipe-left'), S(4, 'cta', 'En savoir plus', 'www.votre-site.com', 'pop', 'circle')] },
  },
  {
    id: 'logo-reveal', category: 'logo', name: 'Révélation de logo', description: 'Logo qui apparaît avec lueur, particules et slogan.',
    plan: { aspect: '16:9', style: { palette: P('#050505', '#F96A00', '#FFB15C'), fontHeading: 'Manrope', fontBody: 'Inter', mood: 'premium', effects: ['particles-sparks', 'vignette'] },
      scenes: [S(5, 'logo', 'Votre slogan', '', 'tracking', 'fade-black', ['glow'])] },
  },
  {
    id: 'story-brand', category: 'story', name: 'Storytelling de marque', description: 'Problème, déclic, solution, résultat, invitation.',
    plan: { aspect: '16:9', style: { palette: P('#120D0A', '#E07A3F', '#F2CC8F'), fontHeading: 'DM Serif Display', fontBody: 'Inter', mood: 'émotion', effects: ['grain', 'vignette', 'color-grade-warm'] },
      scenes: [S(5, 'media', 'Tout a commencé par une idée', '', 'blur-in', 'fade-black', [], 'slow-zoom-in'), S(5, 'media', 'Un défi à relever', 'Décrivez le problème de vos clients', 'mask-up', 'blur-dissolve', [], 'pan-left'), S(5, 'media', 'Notre réponse', 'Décrivez votre solution', 'mask-up', 'blur-dissolve', [], 'push-in'), S(5, 'media', 'Aujourd\'hui', 'Le changement obtenu', 'mask-up', 'fade', [], 'slow-zoom-out'), S(5, 'cta', 'Écrivons la suite ensemble', 'votre-site.com', 'fade', 'fade-white')] },
  },
  {
    id: 'event-teaser', category: 'event', name: 'Teaser d\'événement', description: 'Compte à rebours, programme, lieu et billetterie.',
    plan: { aspect: '16:9', style: { palette: P('#0B0B14', '#7C3AED', '#F472B6'), fontHeading: 'Bebas Neue', fontBody: 'Poppins', mood: 'festif', effects: ['particles-bokeh', 'light-leak'] },
      scenes: [S(1, 'kinetic', '3', '', 'pop', 'flash'), S(1, 'kinetic', '2', '', 'pop', 'flash'), S(1, 'kinetic', '1', '', 'pop', 'flash'), S(4, 'media', 'Le grand événement', '15 juin · Votre ville', 'pop-words', 'zoom-out', ['glow'], 'push-in'), S(4, 'lower-third', 'Au programme', 'Concerts · Conférences · Ateliers', 'mask-up', 'wipe-left', [], 'pan-right'), S(4, 'cta', 'Réservez vos places', 'billetterie.votre-site.com', 'pop', 'circle')] },
  },
];

export const findTemplate = (id) => TEMPLATES.find((t) => t.id === id);
