<?php
require_once __DIR__ . '/inc/auth.php';
exigerConnexion();
require_once __DIR__ . '/inc/fonctions.php';

$schema = require __DIR__ . '/inc/schema.php';
$titrePage = 'Tableau de bord';
$sectionActive = 'dashboard';
require __DIR__ . '/inc/gabarit_debut.php';
?>
      <p style="color:var(--texte-clair); margin-bottom:28px;">
        Modifiez ici le contenu du site — les changements apparaissent sur les pages publiques
        dès l'enregistrement, sans toucher au code.
      </p>

      <div class="grille grille--3" style="gap:24px;">
        <?php foreach ($schema as $cle => $section):
            $donnees = lireJSON($section['fichier'], []);
            $nombre = is_array($donnees) ? count($donnees) : 0;
        ?>
          <a href="editer.php?section=<?= urlencode($cle) ?>" class="carte-dept" style="text-decoration:none; display:block;">
            <span class="sigle"><?= $nombre ?></span>
            <h3><?= htmlspecialchars($section['titre']) ?></h3>
            <p>Ajouter, modifier ou supprimer <?= htmlspecialchars($section['titre_singulier']) ?>.</p>
          </a>
        <?php endforeach; ?>

        <a href="coordonnees.php" class="carte-dept" style="text-decoration:none; display:block;">
          <span class="sigle">☎</span>
          <h3>Coordonnées &amp; réseaux sociaux</h3>
          <p>Téléphone, WhatsApp, e-mail, adresse, Facebook, YouTube, Instagram, TikTok.</p>
        </a>
      </div>

      <div class="admin-message" style="margin-top:32px; background:var(--bleu-glace); color:var(--bleu-nuit); border:1px solid var(--bordure);">
        <strong>Sécurité :</strong> pense à changer le mot de passe par défaut dès que possible
        (voir les instructions dans <code>admin/inc/config.php</code>).
      </div>
<?php require __DIR__ . '/inc/gabarit_fin.php'; ?>
