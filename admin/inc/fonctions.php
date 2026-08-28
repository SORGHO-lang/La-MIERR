<?php
/* Fonctions utilitaires partagées par les pages de l'administration. */

function cheminContenu($nomFichier) {
    return rtrim(DOSSIER_CONTENU, '/') . '/' . $nomFichier;
}

function lireJSON($nomFichier, $defaut = []) {
    $chemin = cheminContenu($nomFichier);
    if (!is_file($chemin)) return $defaut;
    $contenu = file_get_contents($chemin);
    $donnees = json_decode($contenu, true);
    return is_null($donnees) ? $defaut : $donnees;
}

function ecrireJSON($nomFichier, $donnees) {
    $chemin = cheminContenu($nomFichier);
    $json = json_encode($donnees, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    // Écriture atomique : on écrit dans un fichier temporaire puis on renomme,
    // pour ne jamais laisser le site public lire un fichier à moitié écrit.
    $tmp = $chemin . '.tmp';
    file_put_contents($tmp, $json . "\n", LOCK_EX);
    rename($tmp, $chemin);
}

function genererId($texte, $existants = []) {
    $id = strtolower($texte);
    $id = iconv('UTF-8', 'ASCII//TRANSLIT', $id);
    $id = preg_replace('/[^a-z0-9]+/', '-', $id);
    $id = trim($id, '-');
    if ($id === '') $id = 'element';
    $base = $id;
    $i = 2;
    while (in_array($id, $existants, true)) {
        $id = $base . '-' . $i;
        $i++;
    }
    return $id;
}

/* Gère l'envoi d'une image depuis un formulaire (champ <input type="file">).
   Retourne le chemin web (ex. "assets/img/uploads/xxx.jpg") en cas de succès,
   ou null si aucun fichier n'a été envoyé (le champ est alors laissé tel quel
   par l'appelant), ou lève une exception en cas d'erreur/format refusé. */
function gererEnvoiImage($cleChamp) {
    if (empty($_FILES[$cleChamp]) || $_FILES[$cleChamp]['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $fichier = $_FILES[$cleChamp];
    if ($fichier['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException("Erreur lors de l'envoi du fichier (code {$fichier['error']}).");
    }
    if ($fichier['size'] > TAILLE_MAX_IMAGE) {
        throw new RuntimeException('Image trop volumineuse (8 Mo maximum).');
    }
    $info = getimagesize($fichier['tmp_name']);
    if ($info === false) {
        throw new RuntimeException("Le fichier envoyé n'est pas une image valide.");
    }
    $extensionsAutorisees = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];
    $mime = $info['mime'];
    if (!isset($extensionsAutorisees[$mime])) {
        throw new RuntimeException('Formats acceptés : JPEG, PNG, WebP, GIF.');
    }
    if (!is_dir(DOSSIER_UPLOADS_DISQUE)) {
        mkdir(DOSSIER_UPLOADS_DISQUE, 0755, true);
    }
    $nom = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $extensionsAutorisees[$mime];
    $destination = rtrim(DOSSIER_UPLOADS_DISQUE, '/') . '/' . $nom;
    if (!move_uploaded_file($fichier['tmp_name'], $destination)) {
        throw new RuntimeException("Impossible d'enregistrer l'image envoyée.");
    }
    return rtrim(DOSSIER_UPLOADS_WEB, '/') . '/' . $nom;
}

function nettoyerTexte($valeur) {
    return trim((string) $valeur);
}
