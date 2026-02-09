export const APP_VERSION = '0.3.1'

export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
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
