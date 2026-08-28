<?php
require_once __DIR__ . '/inc/auth.php';
exigerConnexion();
require_once __DIR__ . '/inc/fonctions.php';

$CHAMPS = [
    'telephone'          => 'Téléphone (affiché, ex. +226 72 28 10 77)',
    'telephoneLien'       => 'Téléphone (lien tel:, sans espaces, ex. +22672281077)',
    'whatsapp'            => 'WhatsApp (lien wa.me, sans espaces, ex. +22658158788)',
    'whatsappAffichage'   => 'WhatsApp (affiché, ex. +226 58 15 87 88)',
    'email'               => 'E-mail',
    'adresse'             => 'Adresse',
    'horaires'            => 'Horaires',
    'facebook'            => 'Lien Facebook',
    'youtube'             => 'Lien YouTube',
    'instagram'           => 'Lien Instagram',
    'tiktok'              => 'Lien TikTok',
    'mapsEmbed'           => 'Lien de la carte Google Maps (intégration « output=embed »)',
];

$message = '';
$messageType = 'succes';
$donnees = lireJSON('coordonnees.json', []);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();
    foreach ($CHAMPS as $cle => $label) {
        $donnees[$cle] = nettoyerTexte($_POST['champ_' . $cle] ?? '');
    }
    ecrireJSON('coordonnees.json', $donnees);
    $message = 'Coordonnées mises à jour.';
}

$titrePage = 'Coordonnées';
$sectionActive = 'coordonnees';
require __DIR__ . '/inc/gabarit_debut.php';
?>

<?php if ($message): ?>
  <div class="admin-message admin-message--<?= $messageType ?>"><?= htmlspecialchars($message) ?></div>
<?php endif; ?>

<h2>Coordonnées &amp; réseaux sociaux</h2>
<p style="color:var(--texte-clair);">Ces informations apparaissent automatiquement dans l'en-tête, le pied de page et la page Contact de tout le site.</p>

<form method="post" style="max-width:640px;">
  <input type="hidden" name="csrf" value="<?= htmlspecialchars(jetonCsrf()) ?>">
  <?php foreach ($CHAMPS as $cle => $label): ?>
    <div class="groupe-champ">
      <label for="champ_<?= $cle ?>"><?= htmlspecialchars($label) ?></label>
      <input type="text" id="champ_<?= $cle ?>" name="champ_<?= $cle ?>" value="<?= htmlspecialchars($donnees[$cle] ?? '') ?>">
    </div>
  <?php endforeach; ?>
  <div class="bouton-groupe">
    <button type="submit" class="bouton bouton--bleu">Enregistrer</button>
  </div>
</form>

<?php require __DIR__ . '/inc/gabarit_fin.php'; ?>
