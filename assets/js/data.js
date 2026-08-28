/* ==========================================================================
   MIERR — Données du site (contenu structuré)
   --------------------------------------------------------------------------
   Ce fichier centralise les informations qui reviennent sur plusieurs pages
   (coordonnées, réseaux sociaux, événements, fil du temps, index de
   recherche…). Il joue le rôle de « source de vérité » en attendant le
   branchement d'un CMS/back-office : modifier une valeur ici la met à jour
   partout où elle est utilisée (grâce aux attributs data-config-* du HTML).

   Quand le back-office sera en place, ces tableaux pourront être remplacés
   par des appels à une API (fetch) sans changer la structure des pages —
   voir LISEZ-MOI.md, section « Évolution vers un CMS ».
   ========================================================================== */

window.MIERR = {

  /* Coordonnées & réseaux — à remplacer par les informations officielles */
  config: {
    nomComplet: "Mission Internationale Évangélique de Réveil et de Restauration",
    sigle: "MIERR",
    fondation: 2006,
    telephone: "+226 72 28 10 77",
    telephoneLien: "+22672281077",
    whatsapp: "+22658158788",
    whatsappAffichage: "+226 58 15 87 88",
    email: "mierrburkinafaso@yahoo.fr",
    adresse: "Siège international — BP 01 Marcoussi, Ouagadougou, Burkina Faso",
    horaires: "Du lundi au vendredi — 9h à 17h · Cultes le dimanche",
    facebook: "https://facebook.com/mierr",
    youtube: "https://youtube.com/@mierr",
    instagram: "https://instagram.com/mierr",
    tiktok: "https://tiktok.com/@mierr",
    mapsEmbed: "https://www.google.com/maps?q=Ouagadougou,+Burkina+Faso&output=embed"
  },

  /* Fil du temps — La MIERR (2006 → 2026). Ajouter une étape = ajouter un objet. */
  timeline: [
    { annee:"2006", titre:"Naissance de l'œuvre", texte:"Fondation de la Mission Internationale Évangélique de Réveil et de Restauration, portée par une vision de réveil spirituel et de restauration des vies." },
    { annee:"2009", titre:"Structuration de la mission", texte:"Mise en place des premiers départements et des bases de l'organisation hiérarchique de la MIERR." },
    { annee:"2012", titre:"Naissance du SEMIC", texte:"Lancement du département des Servantes Missionnaires de Christ, dédié à l'accompagnement spirituel des femmes." },
    { annee:"2014", titre:"Naissance du JEMOC", texte:"Création du département de la Jeunesse Missionnaire et Ouvriers de Christ pour former la jeunesse au service du Royaume." },
    { annee:"2017", titre:"Ouverture de l'Institut biblique de Sion", texte:"Lancement de l'Institut biblique de formation pastorale de Sion pour la formation des leaders et futurs pasteurs." },
    { annee:"2019", titre:"Naissance du SEMIFIG", texte:"Mise en place de la Section Missionnaire des Filles Glorieuses, dédiée à l'accompagnement des jeunes filles." },
    { annee:"2021", titre:"Maison d'édition SCHÉKINA", texte:"Création de la maison d'édition SCHÉKINA pour la production de publications et supports pédagogiques de la mission." },
    { annee:"2023", titre:"Rayonnement international", texte:"Extension des activités de la MIERR et renforcement des conventions, séminaires et conférences annuelles." },
    { annee:"2026", titre:"20 ans de la MIERR", texte:"Célébration des vingt années de réveil et de restauration : deux décennies au service de l'Évangile et des nations." }
  ],

  /* Agenda — Activités de la MIERR. type sert aux filtres de la page Activités. */
  evenements: [
    { id:"convention", type:"Convention", titre:"9ème Convention de la MIERR — An'20", debut:"2026-07-28", fin:"2026-08-02", lieu:"Siège de l'église MIERR, Ouagadougou (Marcoussis, non loin de la SANAPOST)", responsable:"Présidence de la MIERR", description:"Le grand rendez-vous annuel de toute la famille MIERR, sur le thème « Le plan prophétique de Dieu révélé depuis son trône pour la restauration intégrale de l'homme » (Psaumes 103:19)." },
    { id:"co-semic", type:"SEMIC", titre:"CO-SEMIC — Convention des Servantes Missionnaires de Christ", debut:"2026-03-06", fin:"2026-03-08", lieu:"[Lieu à préciser]", responsable:"Coordination SEMIC", description:"Convention nationale des femmes de la MIERR autour du thème annuel du département." },
    { id:"co-jemoc", type:"JEMOC", titre:"CO-JEMOC — Convention de la Jeunesse Missionnaire et Ouvriers de Christ", debut:"2026-04-17", fin:"2026-04-19", lieu:"[Lieu à préciser]", responsable:"Coordination JEMOC", description:"Le grand rassemblement annuel de la jeunesse MIERR : formation, louange et engagement missionnaire." },
    { id:"vision-aigle", type:"Séminaire", titre:"Séminaire « Vision de l'Aigle »", debut:"2026-01-23", fin:"2026-01-25", lieu:"[Lieu à préciser]", responsable:"Département Formation", description:"Un temps fort d'enseignement sur le renouvellement spirituel, à l'image de l'aigle qui renouvelle sa jeunesse." },
    { id:"seminaire-pentecote", type:"Séminaire", titre:"Séminaire de Pentecôte", debut:"2026-05-22", fin:"2026-05-24", lieu:"[Lieu à préciser]", responsable:"Présidence de la MIERR", description:"Trois jours de consécration et d'attente de la puissance du Saint-Esprit, en mémoire de la Pentecôte." },
    { id:"seminaire-discipolat", type:"Séminaire", titre:"Séminaire sur le discipolat", debut:"2026-09-11", fin:"2026-09-13", lieu:"[Lieu à préciser]", responsable:"Institut biblique de Sion", description:"Formation pratique sur la marche du disciple et l'accompagnement spirituel des nouveaux convertis." },
    { id:"co-semifig", type:"SEMIFIG", titre:"Camp SEMIFIG des Filles Glorieuses", debut:"2026-08-07", fin:"2026-08-09", lieu:"[Lieu à préciser]", responsable:"Coordination SEMIFIG", description:"Un temps de retraite, d'enseignement et de communion pour les jeunes filles de la mission." },
    { id:"20-ans", type:"Convention", titre:"Jubilé — 20 ans de la MIERR", debut:"2026-11-06", fin:"2026-11-08", lieu:"[Lieu à préciser]", responsable:"Présidence de la MIERR", description:"Célébration officielle des vingt années de la MIERR : culte d'actions de grâces, gala et témoignages." }
  ],

  /* Index de recherche globale — chaque entrée pointe vers une page/section du site. */
  recherche: [
    { titre:"La MIERR — Identité, vision & mission", categorie:"La MIERR", url:"la-mierr.html", extrait:"Découvrez l'identité, la vision, la mission, les valeurs et l'histoire de la MIERR depuis 2006." },
    { titre:"Histoire de la MIERR — Fil du temps 2006-2026", categorie:"La MIERR", url:"la-mierr.html#histoire", extrait:"Vingt années de réveil et de restauration retracées étape par étape." },
    { titre:"Organisation hiérarchique", categorie:"La MIERR", url:"la-mierr.html#organisation", extrait:"L'organigramme et la structure de gouvernance de la mission." },
    { titre:"SEMIC — Servantes Missionnaires de Christ", categorie:"Départements", url:"departements.html#semic", extrait:"Le département des femmes de la MIERR." },
    { titre:"JEMOC — Jeunesse Missionnaire et Ouvriers de Christ", categorie:"Départements", url:"departements.html#jemoc", extrait:"Le département de la jeunesse de la MIERR." },
    { titre:"SEMIFIG — Section Missionnaire des Filles Glorieuses", categorie:"Départements", url:"departements.html#semifig", extrait:"L'accompagnement des jeunes filles au sein de la MIERR." },
    { titre:"Travailleurs salariés", categorie:"Départements", url:"departements.html#travailleurs", extrait:"Le service dédié à l'accompagnement des travailleurs salariés." },
    { titre:"Entrepreneurs chrétiens", categorie:"Départements", url:"departements.html#entrepreneurs", extrait:"Le réseau des entrepreneurs de la MIERR." },
    { titre:"Service des événements", categorie:"Départements", url:"departements.html#evenements-service", extrait:"L'organisation des grands rendez-vous de la mission." },
    { titre:"Service communication", categorie:"Départements", url:"departements.html#communication", extrait:"La voix visuelle et digitale de la MIERR." },
    { titre:"Presse MIERR", categorie:"Départements", url:"departements.html#presse-mierr", extrait:"Le service de presse et d'information de la mission." },
    { titre:"Maison d'édition SCHÉKINA", categorie:"Départements", url:"departements.html#schekina", extrait:"Publications, ouvrages et supports pédagogiques de la MIERR." },
    { titre:"Institut biblique de formation pastorale de Sion", categorie:"Formation", url:"institut-biblique.html", extrait:"Formations bibliques et pastorales, conditions d'admission, inscription en ligne." },
    { titre:"9ème Convention de la MIERR — An'20", categorie:"Activités", url:"activites.html#convention", extrait:"Le grand rendez-vous annuel de toute la famille MIERR, du 28 juillet au 2 août." },
    { titre:"CO-SEMIC", categorie:"Activités", url:"activites.html#co-semic", extrait:"Convention nationale des Servantes Missionnaires de Christ." },
    { titre:"CO-JEMOC", categorie:"Activités", url:"activites.html#co-jemoc", extrait:"Convention de la jeunesse missionnaire." },
    { titre:"Vision de l'Aigle", categorie:"Activités", url:"activites.html#vision-aigle", extrait:"Séminaire de renouvellement spirituel." },
    { titre:"Séminaire de Pentecôte", categorie:"Activités", url:"activites.html#seminaire-pentecote", extrait:"Un temps fort d'attente de la puissance du Saint-Esprit." },
    { titre:"Séminaire sur le discipolat", categorie:"Activités", url:"activites.html#seminaire-discipolat", extrait:"Formation pratique sur la marche du disciple." },
    { titre:"Galerie photos & vidéos", categorie:"Médias", url:"galerie.html", extrait:"Les temps forts de la MIERR en images." },
    { titre:"Prédications & enseignements", categorie:"Médias", url:"presse.html#videotheque", extrait:"Vidéothèque : prédications, enseignements, conférences, témoignages." },
    { titre:"Podcasts & audio", categorie:"Médias", url:"presse.html#audiotheque", extrait:"La bibliothèque audio de la MIERR." },
    { titre:"Publications & magazines", categorie:"Médias", url:"presse.html#publications", extrait:"Les publications éditées par SCHÉKINA." },
    { titre:"Actualités de la MIERR", categorie:"Actualités", url:"actualites.html", extrait:"Annonces, communiqués et témoignages de la mission." },
    { titre:"Nous contacter", categorie:"Contact", url:"contact.html", extrait:"Formulaire de contact, adresse, téléphone et réseaux sociaux." },
    { titre:"Inscription à l'Institut biblique", categorie:"Formation", url:"institut-biblique.html#inscription", extrait:"Formulaire d'inscription en ligne à l'Institut biblique de Sion." }
  ]
};
