<?php
/* En-tête commun à toutes les pages de l'administration (une fois connecté).
   Variables attendues : $titrePage (string), $sectionActive (string, optionnel). */
$sectionActive = $sectionActive ?? '';
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title><?= htmlspecialchars($titrePage ?? "Administration") ?> — Espace d'administration MIERR</title>
<link rel="icon" href="../assets/img/favicon.png" type="image/png">
<link rel="stylesheet" href="../assets/css/style.css">
<link rel="stylesheet" href="assets/admin.css">
</head>
<body class="admin-corps">
  <div class="admin-carte">
    <div class="admin-entete">
      <h1>Administration MIERR</h1>
      <div>
        <a href="../index.html" target="_blank" rel="noopener">Voir le site ↗</a>
        &nbsp;·&nbsp;
        <a href="logout.php">Se déconnecter</a>
      </div>
    </div>
    <div class="admin-corps-interieur">
      <nav class="admin-nav">
        <a href="dashboard.php" class="<?= $sectionActive === 'dashboard' ? 'actif' : '' ?>">Tableau de bord</a>
        <a href="editer.php?section=actualites" class="<?= $sectionActive === 'actualites' ? 'actif' : '' ?>">Actualités</a>
        <a href="editer.php?section=evenements" class="<?= $sectionActive === 'evenements' ? 'actif' : '' ?>">Agenda</a>
        <a href="editer.php?section=galerie" class="<?= $sectionActive === 'galerie' ? 'actif' : '' ?>">Galerie</a>
        <a href="editer.php?section=direction" class="<?= $sectionActive === 'direction' ? 'actif' : '' ?>">Direction</a>
        <a href="coordonnees.php" class="<?= $sectionActive === 'coordonnees' ? 'actif' : '' ?>">Coordonnées</a>
      </nav>
