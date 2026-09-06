<?php
require_once __DIR__ . '/inc/auth.php';
exigerConnexion();
require_once __DIR__ . '/inc/fonctions.php';

$message = '';
$messageType = 'succes';
$donnees = lireJSON('verset.json', []);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();
    $donnees['texte'] = nettoyerTexte($_POST['champ_texte'] ?? '');
    $donnees['reference'] = nettoyerTexte($_POST['champ_reference'] ?? '');
    ecrireJSON('verset.json', $donnees);
    $message = 'Parole du jour mise à jour.';
}

$titrePage = 'Parole du jour';
$sectionActive = 'verset';
require __DIR__ . '/inc/gabarit_debut.php';
?>

<?php if ($message): ?>
  <div class="admin-message admin-message--<?= $messageType ?>"><?= htmlspecialchars($message) ?></div>
<?php endif; ?>

<h2>Parole du jour</h2>
<p style="color:var(--texte-clair);">Ce verset apparaît automatiquement dans la section « Parole du jour » de la page d'accueil (les guillemets sont ajoutés automatiquement, inutile de les taper).</p>

<form method="post" style="max-width:640px;">
  <input type="hidden" name="csrf" value="<?= htmlspecialchars(jetonCsrf()) ?>">
  <div class="groupe-champ">
    <label for="champ_texte">Texte du verset</label>
    <textarea id="champ_texte" name="champ_texte" rows="6" required><?= htmlspecialchars($donnees['texte'] ?? '') ?></textarea>
  </div>
  <div class="groupe-champ">
    <label for="champ_reference">Référence (ex. Ésaïe 42:6-8)</label>
    <input type="text" id="champ_reference" name="champ_reference" value="<?= htmlspecialchars($donnees['reference'] ?? '') ?>" required>
  </div>
  <div class="bouton-groupe">
    <button type="submit" class="bouton bouton--bleu">Enregistrer</button>
  </div>
</form>

<?php require __DIR__ . '/inc/gabarit_fin.php'; ?>
