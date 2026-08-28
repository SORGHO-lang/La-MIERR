<?php
require_once __DIR__ . '/inc/auth.php';

if (estConnecte()) {
    header('Location: dashboard.php');
    exit;
}

$erreur = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $motDePasse = $_POST['mot_de_passe'] ?? '';
    if (password_verify($motDePasse, ADMIN_MOT_DE_PASSE_HASH)) {
        session_regenerate_id(true);
        $_SESSION['mierr_admin_connecte'] = true;
        header('Location: dashboard.php');
        exit;
    }
    $erreur = 'Mot de passe incorrect.';
}
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Connexion — Espace d'administration MIERR</title>
<link rel="icon" href="../assets/img/favicon.png" type="image/png">
<link rel="stylesheet" href="../assets/css/style.css">
<link rel="stylesheet" href="assets/admin.css">
</head>
<body class="admin-corps">
  <div class="admin-carte admin-connexion">
    <img src="../assets/img/logo-mierr.png" alt="MIERR" style="height:56px; display:block; margin:0 auto 20px;">
    <h1>Espace d'administration</h1>
    <p style="color:var(--texte-clair);">Connectez-vous pour modifier le contenu du site.</p>
    <?php if ($erreur): ?>
      <div class="admin-message admin-message--erreur"><?= htmlspecialchars($erreur) ?></div>
    <?php endif; ?>
    <form method="post" novalidate>
      <div class="groupe-champ">
        <label for="mot_de_passe">Mot de passe</label>
        <input type="password" id="mot_de_passe" name="mot_de_passe" required autofocus>
      </div>
      <button type="submit" class="bouton bouton--bleu bouton--pleine-largeur">Se connecter</button>
    </form>
  </div>
</body>
</html>
