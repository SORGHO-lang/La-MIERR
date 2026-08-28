<?php
require_once __DIR__ . '/inc/auth.php';
exigerConnexion();
require_once __DIR__ . '/inc/fonctions.php';

$schema = require __DIR__ . '/inc/schema.php';
$cleSection = $_GET['section'] ?? '';
if (!isset($schema[$cleSection])) {
    http_response_code(404);
    die('Section inconnue.');
}
$section = $schema[$cleSection];
$action = $_GET['action'] ?? 'liste';
$message = '';
$messageType = 'succes';

/* ---------- Traitement des actions (POST) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifierCsrf();
    $elements = lireJSON($section['fichier'], []);

    if (($_POST['operation'] ?? '') === 'supprimer') {
        $id = $_POST['id'] ?? '';
        $elements = array_values(array_filter($elements, function ($e) use ($id) {
            return ($e['id'] ?? '') !== $id;
        }));
        ecrireJSON($section['fichier'], $elements);
        header('Location: editer.php?section=' . urlencode($cleSection) . '&ok=' . urlencode('Élément supprimé.'));
        exit;
    }

    if (($_POST['operation'] ?? '') === 'enregistrer') {
        try {
            $idExistant = $_POST['id_existant'] ?? '';
            $idsExistants = array_map(function ($e) { return $e['id'] ?? ''; }, $elements);

            $item = [];
            foreach ($section['champs'] as $cle => $champ) {
                if ($champ['type'] === 'image') {
                    $nouvelleImage = gererEnvoiImage('champ_' . $cle);
                    if ($nouvelleImage !== null) {
                        $item[$cle] = $nouvelleImage;
                    } elseif ($idExistant !== '') {
                        // Conserver l'image existante si aucune nouvelle n'est envoyée.
                        foreach ($elements as $e) {
                            if (($e['id'] ?? '') === $idExistant) { $item[$cle] = $e[$cle] ?? ''; break; }
                        }
                    } else {
                        $item[$cle] = '';
                    }
                    if ($champ['requis'] && empty($item[$cle])) {
                        throw new RuntimeException(htmlspecialchars($champ['label']) . ' est obligatoire.');
                    }
                } else {
                    $valeur = nettoyerTexte($_POST['champ_' . $cle] ?? '');
                    if (!empty($champ['requis']) && $valeur === '') {
                        throw new RuntimeException(htmlspecialchars($champ['label']) . ' est obligatoire.');
                    }
                    $item[$cle] = $valeur;
                }
            }

            // Cas particulier : reconstruire le tableau "boutons" pour les événements,
            // à partir des deux paires texte/lien du formulaire (plus simple à éditer
            // qu'une liste libre pour un utilisateur non technique).
            if ($cleSection === 'evenements') {
                $boutons = [];
                if (!empty($item['bouton1_texte']) && !empty($item['bouton1_url'])) {
                    $boutons[] = ['texte' => $item['bouton1_texte'], 'url' => $item['bouton1_url'], 'style' => 'bouton--bleu bouton--petit'];
                }
                if (!empty($item['bouton2_texte']) && !empty($item['bouton2_url'])) {
                    $boutons[] = ['texte' => $item['bouton2_texte'], 'url' => $item['bouton2_url'], 'style' => 'bouton--ligne bouton--petit'];
                }
                $item['boutons'] = $boutons;
                unset($item['bouton1_texte'], $item['bouton1_url'], $item['bouton2_texte'], $item['bouton2_url']);
            }

            if ($idExistant !== '') {
                $item['id'] = $idExistant;
                foreach ($elements as $i => $e) {
                    if (($e['id'] ?? '') === $idExistant) { $elements[$i] = $item; break; }
                }
            } else {
                $texteId = $item[$section['titre_affiche']] ?? 'element';
                $item['id'] = genererId($texteId, $idsExistants);
                $elements[] = $item;
            }

            ecrireJSON($section['fichier'], $elements);
            header('Location: editer.php?section=' . urlencode($cleSection) . '&ok=' . urlencode('Enregistré avec succès.'));
            exit;
        } catch (RuntimeException $e) {
            $message = $e->getMessage();
            $messageType = 'erreur';
            $action = 'form';
        }
    }
}

$elements = lireJSON($section['fichier'], []);
if (isset($_GET['ok'])) { $message = $_GET['ok']; $messageType = 'succes'; }

$elementEdite = null;
if ($action === 'form' && !empty($_GET['id'])) {
    foreach ($elements as $e) {
        if (($e['id'] ?? '') === $_GET['id']) { $elementEdite = $e; break; }
    }
}
// En cas d'erreur de validation, on réaffiche ce que l'utilisateur avait saisi.
if ($messageType === 'erreur' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $elementEdite = $elementEdite ?? [];
    foreach ($section['champs'] as $cle => $champ) {
        if ($champ['type'] !== 'image') {
            $elementEdite[$cle] = $_POST['champ_' . $cle] ?? ($elementEdite[$cle] ?? '');
        }
    }
    if ($cleSection === 'evenements') {
        foreach (['bouton1_texte', 'bouton1_url', 'bouton2_texte', 'bouton2_url'] as $c) {
            $elementEdite[$c] = $_POST['champ_' . $c] ?? '';
        }
    }
    $_GET['id'] = $_POST['id_existant'] ?? '';
}

$titrePage = $section['titre'];
$sectionActive = $cleSection;
require __DIR__ . '/inc/gabarit_debut.php';
?>

<?php if ($message): ?>
  <div class="admin-message admin-message--<?= $messageType ?>"><?= htmlspecialchars($message) ?></div>
<?php endif; ?>

<?php if ($action === 'form'): ?>

  <div class="admin-fil"><a href="editer.php?section=<?= urlencode($cleSection) ?>">← Retour à la liste</a></div>
  <h2><?= $elementEdite ? 'Modifier' : 'Ajouter' ?> <?= htmlspecialchars($section['titre_singulier']) ?></h2>

  <form method="post" enctype="multipart/form-data" style="max-width:640px;">
    <input type="hidden" name="csrf" value="<?= htmlspecialchars(jetonCsrf()) ?>">
    <input type="hidden" name="operation" value="enregistrer">
    <input type="hidden" name="id_existant" value="<?= htmlspecialchars($_GET['id'] ?? '') ?>">

    <?php foreach ($section['champs'] as $cle => $champ):
        $valeur = $elementEdite[$cle] ?? '';
    ?>
      <div class="groupe-champ">
        <label for="champ_<?= $cle ?>"><?= htmlspecialchars($champ['label']) ?><?= !empty($champ['requis']) ? ' *' : '' ?></label>

        <?php if ($champ['type'] === 'textarea'): ?>
          <textarea id="champ_<?= $cle ?>" name="champ_<?= $cle ?>" <?= !empty($champ['requis']) ? 'required' : '' ?>><?= htmlspecialchars($valeur) ?></textarea>

        <?php elseif ($champ['type'] === 'select'): ?>
          <select id="champ_<?= $cle ?>" name="champ_<?= $cle ?>" <?= !empty($champ['requis']) ? 'required' : '' ?>>
            <option value="">— Choisir —</option>
            <?php foreach ($champ['options'] as $option): ?>
              <option value="<?= htmlspecialchars($option) ?>" <?= $valeur === $option ? 'selected' : '' ?>><?= htmlspecialchars($option) ?></option>
            <?php endforeach; ?>
          </select>

        <?php elseif ($champ['type'] === 'date'): ?>
          <input type="date" id="champ_<?= $cle ?>" name="champ_<?= $cle ?>" value="<?= htmlspecialchars($valeur) ?>" <?= !empty($champ['requis']) ? 'required' : '' ?>>

        <?php elseif ($champ['type'] === 'image'): ?>
          <?php if (!empty($valeur)): ?>
            <img src="../<?= htmlspecialchars($valeur) ?>" alt="" class="admin-apercu-image">
          <?php endif; ?>
          <input type="file" id="champ_<?= $cle ?>" name="champ_<?= $cle ?>" accept="image/*">
          <small><?= $valeur ? 'Laisser vide pour conserver l’image actuelle.' : 'JPEG, PNG, WebP ou GIF — 8 Mo maximum.' ?></small>

        <?php else: ?>
          <input type="text" id="champ_<?= $cle ?>" name="champ_<?= $cle ?>" value="<?= htmlspecialchars($valeur) ?>" <?= !empty($champ['requis']) ? 'required' : '' ?>>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>

    <div class="bouton-groupe">
      <button type="submit" class="bouton bouton--bleu">Enregistrer</button>
      <a href="editer.php?section=<?= urlencode($cleSection) ?>" class="bouton bouton--ligne">Annuler</a>
    </div>
  </form>

<?php else: ?>

  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
    <h2 style="margin:0;"><?= htmlspecialchars($section['titre']) ?></h2>
    <a href="editer.php?section=<?= urlencode($cleSection) ?>&action=form" class="bouton bouton--or bouton--petit">+ Ajouter</a>
  </div>

  <?php if (empty($elements)): ?>
    <div class="admin-vide">Rien n'a encore été ajouté ici. Le site public affiche pour l'instant son contenu de démonstration.</div>
  <?php else: ?>
    <div style="overflow-x:auto;">
      <table class="admin-tableau">
        <thead>
          <tr>
            <?php $aUneImage = isset($section['champs']['image']); ?>
            <?php if ($aUneImage): ?><th></th><?php endif; ?>
            <th><?= htmlspecialchars($section['champs'][$section['titre_affiche']]['label']) ?></th>
            <th>Détails</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($elements as $e): ?>
            <tr>
              <?php if ($aUneImage): ?>
                <td><?php if (!empty($e['image'])): ?><img src="../<?= htmlspecialchars($e['image']) ?>" alt=""><?php endif; ?></td>
              <?php endif; ?>
              <td><strong><?= htmlspecialchars($e[$section['titre_affiche']] ?? '') ?></strong></td>
              <td style="color:var(--texte-clair); font-size:.85rem;">
                <?php
                  $extraits = [];
                  foreach (['type', 'categorie', 'album', 'fonction', 'debut', 'date'] as $c) {
                      if (!empty($e[$c])) $extraits[] = $e[$c];
                  }
                  echo htmlspecialchars(implode(' · ', $extraits));
                ?>
              </td>
              <td class="admin-actions">
                <a href="editer.php?section=<?= urlencode($cleSection) ?>&action=form&id=<?= urlencode($e['id']) ?>" class="bouton bouton--ligne">Modifier</a>
                <form method="post" onsubmit="return confirm('Supprimer définitivement cet élément ?');" style="display:inline;">
                  <input type="hidden" name="csrf" value="<?= htmlspecialchars(jetonCsrf()) ?>">
                  <input type="hidden" name="operation" value="supprimer">
                  <input type="hidden" name="id" value="<?= htmlspecialchars($e['id']) ?>">
                  <button type="submit" class="bouton bouton--ligne" style="color:var(--erreur); border-color:var(--erreur);">Supprimer</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>

<?php endif; ?>

<?php require __DIR__ . '/inc/gabarit_fin.php'; ?>
