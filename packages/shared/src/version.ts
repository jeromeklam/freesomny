export const APP_VERSION = '0.6.6'

export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.6.6',
    date: '2026-02-13',
    changes: [
      'Correction : les variables d\'environnement et le mode d\'envoi sont maintenant lus au moment de l\'envoi (plus de valeurs obsolètes)',
      'Verrouillage de l\'environnement par onglet : bouton cadenas à côté du sélecteur (désactivé par défaut = environnement global)',
      'Rafraîchissement automatique des variables d\'environnement (10s au lieu de 60s, rechargement au focus)',
      'Amélioration de la visibilité des noms de clé dans l\'onglet En-têtes',
    ],
  },
  {
    version: '0.6.5',
    date: '2026-02-12',
    changes: [
      'Logo et favicon améliorés : meilleure visibilité, contrastes renforcés, mode clair/sombre automatique',
      'Favicon adaptatif : s\'adapte au thème système (clair ou sombre) via prefers-color-scheme',
      'PWA : service worker pour mise en cache de l\'application (installable sur mobile et bureau)',
    ],
  },
  {
    version: '0.6.4',
    date: '2026-02-12',
    changes: [
      'Logo FreeSomnia : lune croissant pêchant des accolades { } (canne à pêche, ligne tendue, action)',
      'Favicon SVG + ICO + PNG (16/32/48/180/192/512) + manifest PWA',
      'Logo affiché sur l\'écran de connexion',
    ],
  },
  {
    version: '0.6.3',
    date: '2026-02-12',
    changes: [
      'Mémorisation du mode d\'envoi par onglet : changer d\'onglet restaure automatiquement le mode (serveur, navigateur, agent)',
    ],
  },
  {
    version: '0.6.2',
    date: '2026-02-12',
    changes: [
      'Correction : la coloration des variables {{}} dans la barre d\'URL (vert/rouge) fonctionne à nouveau après la mise à jour des variables protégées',
      'Mémorisation de l\'environnement par onglet : changer d\'onglet restaure automatiquement l\'environnement sélectionné',
      'Héritage d\'environnement : ouvrir une requête d\'une collection qui a déjà un onglet ouvert hérite de son environnement',
      'Sélecteur d\'environnement encore plus large (300px) pour les noms longs',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-02-12',
    changes: [
      'Aperçu HTML dans l\'onglet Body de la réponse : bouton pour basculer entre le texte brut et le rendu HTML (utile pour les erreurs PHP, pages serveur)',
      'Sélecteur d\'environnement élargi dans l\'en-tête pour afficher les noms longs',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-02-12',
    changes: [
      'Variables d\'environnement protégées : le propriétaire ou l\'admin du groupe peut verrouiller des variables',
      'Les variables protégées sont en lecture seule pour les autres membres (valeur d\'équipe non modifiable)',
      'Les membres peuvent créer un remplacement local sur une variable protégée (avec confirmation et badge d\'avertissement)',
      'Icône bouclier (Shield) pour activer/désactiver la protection dans la modale d\'environnement',
    ],
  },
  {
    version: '0.5.9',
    date: '2026-02-12',
    changes: [
      'Correction : les sous-dossiers et requêtes des collections de groupe sont maintenant visibles par tous les membres',
      'Nettoyage complet des préférences et du cache lors de la déconnexion (plus de persistance entre utilisateurs)',
      'Favoris par utilisateur : chaque utilisateur a ses propres favoris (nouveau modèle UserFavorite)',
    ],
  },
  {
    version: '0.5.8',
    date: '2026-02-11',
    changes: [
      'Correction : le lien de vérification d\'email ne fonctionnait qu\'une fois sur deux (double appel API)',
      'Sélecteur d\'environnement : icône de modification sur chaque environnement (ouvre directement la modale)',
      'Barre d\'URL : les variables {{}} sont remplacées par leurs valeurs résolues hors focus (vert = résolu, rouge = indéfini)',
      'Menus contextuels du panneau latéral : largeur auto-adaptative, plus de retour à la ligne sur les libellés longs',
    ],
  },
  {
    version: '0.5.7',
    date: '2026-02-11',
    changes: [
      'Autocomplétion des utilisateurs lors de l\'ajout d\'un membre à un groupe (admin)',
      'Correction : l\'onglet « Connexion » fonctionne après une inscription réussie',
      'Confirmation du mot de passe lors de l\'inscription',
    ],
  },
  {
    version: '0.5.6',
    date: '2026-02-11',
    changes: [
      'Tri alphabétique des enfants d\'une collection (sous-dossiers + requêtes) via le menu contextuel',
      'Correction : le curseur ne saute plus en fin de chaîne lors de la saisie dans les champs clé/valeur',
      'Correction : les variables d\'environnement ne déclenchent plus un appel API à chaque frappe (sauvegarde au blur)',
    ],
  },
  {
    version: '0.5.5',
    date: '2026-02-10',
    changes: [
      'Correction : texte blanc sur le bouton Envoyer en thème clair (meilleure visibilité)',
      'Dédoublonnage des en-têtes et paramètres hérités : seule la valeur du dossier parent le plus proche est affichée',
      'Remplacement utilisateur visible : badge « Remplacé » sur l\'en-tête hérité et bordure orange sur la valeur personnalisée',
    ],
  },
  {
    version: '0.5.4',
    date: '2026-02-10',
    changes: [
      'Sélecteur de thème : clair, sombre et auto (préférence système)',
      'Thème persisté dans les préférences utilisateur (comme la langue)',
      'Bouton de cycle dans l\'en-tête avec icônes Soleil / Lune / Moniteur',
      'Support complet du mode clair sur tous les composants et modales',
    ],
  },
  {
    version: '0.5.3',
    date: '2026-02-10',
    changes: [
      'Correction : les scripts pré/post-requête ne bloquent plus l\'exécution quand isolated-vm est indisponible',
      'Recompilation automatique d\'isolated-vm lors du déploiement (npm rebuild dans install.sh)',
      'Correction : la coloration des variables {{}} (vert/rouge) se met à jour instantanément au changement d\'environnement',
    ],
  },
  {
    version: '0.5.2',
    date: '2026-02-09',
    changes: [
      'Kit de déploiement autonome : tarball sans pnpm/npm/prisma sur le serveur cible',
      'Utilisation de `pnpm deploy --prod` pour un node_modules complet et plat',
      'Patch automatique du schéma Prisma (SQLite → PostgreSQL + binaryTargets Linux)',
      'Import paresseux de isolated-vm pour compatibilité multi-plateforme',
      'Migrations PostgreSQL via psql direct (plus besoin de prisma CLI en production)',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-02-09',
    changes: [
      'Correction du déploiement : utilisation de Prisma local (5.x) au lieu de npx (7.x) dans install.sh',
      'Ajout du script de migration PostgreSQL pour les favoris (migrate-postgresql-favorites.sql)',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-02-09',
    changes: [
      'Favoris : marquer les requêtes comme favorites avec une étoile',
      'Section « FAVORIS » repliable dans le panneau latéral au-dessus des collections',
      'Ajout/retrait des favoris via l\'icône étoile ou le menu contextuel',
      'Nom de la collection affiché à côté de chaque favori',
      'Nettoyage automatique des lignes vides dans les en-têtes et paramètres',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-02-09',
    changes: [
      'Barre de recherche dans le panneau latéral : filtrage des collections et requêtes par nom',
      'Correction de la suppression des en-têtes dans les paramètres de dossier (race condition)',
      'Correction de la visibilité du bouton poubelle sur les en-têtes',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-02-09',
    changes: [
      'Renommage des requêtes : double-clic sur l\'onglet ou dans le panneau latéral',
      'Option « Renommer » dans le menu contextuel des requêtes',
      'Administration : gestion des environnements dans l\'onglet Groupes (ajout/retrait)',
      'Badge groupe hérité (violet atténué) sur les sous-dossiers d\'une collection de groupe',
      'Administration : gestion des collections dans l\'onglet Groupes (ajout/retrait)',
      'Support SMTP non authentifié (port 25, relais interne) pour l\'envoi d\'emails',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-02-09',
    changes: [
      'Badge groupe hérité (violet atténué) sur les sous-dossiers d\'une collection de groupe',
      'Affichage du groupe hérité en lecture seule dans l\'onglet Général des dossiers',
      'Administration : gestion des collections dans l\'onglet Groupes (ajout/retrait)',
      'Renommage « Dossiers » → « Collections » dans l\'administration des groupes',
      'Support SMTP non authentifié (port 25, relais interne) pour l\'envoi d\'emails',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-02-09',
    changes: [
      'Assignation de dossiers et environnements aux groupes depuis l\'interface',
      'Badge groupe (violet) sur les dossiers dans l\'arborescence',
      'Retrait d\'un dossier/environnement d\'un groupe (retour personnel)',
      'Description globale des requêtes (notes/commentaires)',
      'Génération de code (cURL, PHP, Python) incluant les en-têtes hérités et d\'authentification',
      'Support de tous les types d\'authentification dans la génération de code (jwt_freefw, apikey, oauth2, openid)',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-02-09',
    changes: [
      'Coloration syntaxique des variables {{}} dans la barre d\'URL (vert = définie, rouge = indéfinie)',
      'Correction de la hauteur du bouton déroulant d\'envoi',
      'Icônes de duplication et suppression d\'environnement toujours visibles',
      'Valeurs d\'équipe plus visibles dans la modale d\'environnement',
      'Prévisualisation des variables sur les éléments hérités (en-têtes et paramètres)',
      'Amélioration du script d\'installation (gestion PGPASSWORD depuis .env)',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-02-09',
    changes: [
      'Duplication d\'environnements avec toutes les variables et remplacements',
      'Modale d\'environnement : valeurs empilées verticalement (équipe + remplacement)',
      'Prévisualisation des variables {{}} avec indicateur vert/rouge sur les éléments hérités',
      'Indicateur de remplacement sur les en-têtes/paramètres hérités avec clic pour remplacer',
      'Flux d\'inscription : vérification email + approbation administrateur',
      'Insertion avant/après dans l\'arborescence du panneau latéral',
      'Script d\'installation (install.sh) avec migration PostgreSQL automatique',
      'Gestionnaire de version et journal des modifications',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-02-07',
    changes: [
      'Version initiale : client API avec dossiers, requêtes, environnements',
      'Authentification JWT, tableau de bord administrateur',
      'Import Postman, Hoppscotch, cURL, OpenAPI',
      'Constructeur de requêtes JSON:API (filtres, tri, inclusion, pagination, champs)',
      'Héritage de dossiers (en-têtes, paramètres, authentification, baseUrl)',
      'Gestion des en-têtes d\'autorisation (onglet Auth exclusif)',
      'Mot de passe oublié avec email SMTP ou console',
    ],
  },
]
