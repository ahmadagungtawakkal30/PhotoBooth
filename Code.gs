const MASTER_FOLDER_ID = '1x3ewJR0KW7Q97OSFH-KcaaeGy54Z0ddq';

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Request tidak berisi data.');
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'upload';

    if (action === 'get_album') {
      const folder = DriveApp.getFolderById(MASTER_FOLDER_ID);
      const files = folder.getFiles();
      const photoList = [];

      // getFiles() hanya mengambil file yang berada langsung di Master Folder.
      while (files.hasNext()) {
        const file = files.next();
        const mimeType = file.getMimeType();

        if (!mimeType || !mimeType.startsWith('image/')) {
          continue;
        }

        try {
          file.setSharing(
            DriveApp.Access.ANYONE_WITH_LINK,
            DriveApp.Permission.VIEW
          );
        } catch (sharingError) {
          console.warn(
            'Tidak dapat mengatur akses file ' +
              file.getId() +
              ': ' +
              sharingError
          );
        }

        photoList.push({
          id: file.getId(),
          mimeType: mimeType,
          url:
            'https://drive.google.com/thumbnail?id=' +
            encodeURIComponent(file.getId()) +
            '&sz=w1600',
          likes: parseInt(file.getDescription(), 10) || 0,
          date: file.getDateCreated().getTime()
        });
      }

      photoList.sort(function (a, b) {
        if (b.likes === a.likes) {
          return b.date - a.date;
        }

        return b.likes - a.likes;
      });

      return jsonResponse({
        success: true,
        data: photoList
      });
    }

    if (action === 'delete') {
      if (!data.fileId) {
        throw new Error('fileId wajib diisi untuk menghapus foto.');
      }

      const file = DriveApp.getFileById(data.fileId);
      const masterFolder = DriveApp.getFolderById(MASTER_FOLDER_ID);
      const folders = masterFolder.getFoldersByName('Log Hapus');
      const logFolder = folders.hasNext()
        ? folders.next()
        : masterFolder.createFolder('Log Hapus');

      file.moveTo(logFolder);
      return jsonResponse({ success: true });
    }

    if (action === 'like_photo') {
      if (!data.fileId) {
        throw new Error('fileId wajib diisi untuk memberi like.');
      }

      const file = DriveApp.getFileById(data.fileId);
      const likes = (parseInt(file.getDescription(), 10) || 0) + 1;
      file.setDescription(String(likes));

      return jsonResponse({
        success: true,
        likes: likes
      });
    }

    if (action === 'upload') {
      if (typeof data.image !== 'string' || !data.image) {
        throw new Error('Data gambar tidak ditemukan.');
      }

      const match = data.image.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );
      if (!match) {
        throw new Error('Format data gambar tidak valid.');
      }

      const contentType = match[1];
      const bytes = Utilities.base64Decode(match[2]);
      const timestamp = Utilities.formatDate(
        new Date(),
        'Asia/Jakarta',
        'yyyyMMdd_HHmmss'
      );
      const randomNum = String(Math.floor(Math.random() * 1000))
        .padStart(3, '0');
      const extension = contentType.split('/')[1].toLowerCase() === 'jpeg'
        ? 'jpg'
        : contentType.split('/')[1].toLowerCase();
      const fileName =
        'Foto_' + timestamp + '_' + randomNum + '.' + extension;
      const blob = Utilities.newBlob(bytes, contentType, fileName);
      const folder = DriveApp.getFolderById(MASTER_FOLDER_ID);
      const file = folder.createFile(blob);

      file.setDescription('0');
      file.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW
      );

      return jsonResponse({
        success: true,
        fileUrl: file.getUrl(),
        fileId: file.getId()
      });
    }

    return jsonResponse({
      success: false,
      error: 'Aksi tidak dikenal: ' + action
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message || String(error)
    });
  }
}
