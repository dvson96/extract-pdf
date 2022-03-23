var pdfjsLib = window["pdfjs-dist/build/pdf"];

// The workerSrc property shall be specified.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://mozilla.github.io/pdf.js/build/pdf.worker.js";

var imageTypes = [
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintImageXObjectRepeat,
  pdfjsLib.OPS.paintJpegXObject,
];

function addAlphaChannelToUnit8ClampedArray(
  unit8Array,
  imageWidth,
  imageHeight
) {
  const newImageData = new Uint8ClampedArray(imageWidth * imageHeight * 4);

  for (let j = 0, k = 0, jj = imageWidth * imageHeight * 4; j < jj; ) {
    newImageData[j++] = unit8Array[k++];
    newImageData[j++] = unit8Array[k++];
    newImageData[j++] = unit8Array[k++];
    newImageData[j++] = 255;
  }

  return newImageData;
}

async function getText(pdfUrl) {
  var pdf = await pdfjsLib.getDocument(pdfUrl);
  return pdf.promise.then(function (pdf) {
    // get all pages text
    var maxPages = pdf.numPages;
    var countPromises = []; // collecting all page promises
    for (var j = 1; j <= maxPages; j++) {
      var page = pdf.getPage(j);

      countPromises.push(
        page.then(function (page) {
          // add page promise
          var textContent = page.getTextContent();
          return textContent.then(function (text) {
            // return content promise
            return text.items
              .map(function (s) {
                return s.str;
              })
              .join(""); // value page text
          });
        })
      );
    }
    // Wait for all pages and join text
    return Promise.all(countPromises).then(function (texts) {
      return texts.join("");
    });
  });
}

async function getImages(pdfUrl) {
  var pdf = await (await pdfjsLib.getDocument(pdfUrl)).promise;

  var maxPages = pdf.numPages;

  const images = [];

  for (var j = 1; j <= maxPages; j++) {
    var page = await pdf.getPage(j);
    var ops = await page.getOperatorList();

    for (var i = 0; i < ops.fnArray.length; i++) {
      if (imageTypes.includes(ops.fnArray[i])) {
        console.log(`Found image: ${ops.argsArray[i][0]}`);

        const objName = ops.argsArray[i][0];

        console.log(`Downloading image: ${ops.argsArray[i][0]}`);
        const rawImgObj = await page.objs.get(objName);
        console.log(`Image downloaded: ${ops.argsArray[i][0]}`);

        const imageData = new ImageData(
          addAlphaChannelToUnit8ClampedArray(
            rawImgObj.data,
            rawImgObj.width,
            rawImgObj.height
          ),
          rawImgObj.width,
          rawImgObj.height
        );

        const canvas = document.createElement("canvas");
        document.body.prepend(canvas);
        canvas.style.position = "fixed";
        canvas.style.left = "101%";
        canvas.width = rawImgObj.width;
        canvas.height = rawImgObj.height;
        const ctx = canvas.getContext("2d");
        ctx.putImageData(imageData, 0, 0);
        const base64 = canvas.toDataURL();
        canvas.remove();

        const blob = await fetch(base64).then((res) => res.blob());
        const url = URL.createObjectURL(blob);

        images.push({
          url,
          base64,
          name: `${objName}.png`,
          blob,
          unit8Array: imageData.data,
          width: rawImgObj.width,
          height: rawImgObj.height,
        });
      }
    }
  }
  return images;
}

getText("file.pdf").then((t) => {
  document.body.querySelector(".text").innerHTML = t;
});

getImages("file.pdf").then((imgs) => {
  var text = "";
  imgs.forEach((img) => {
    text += `<div style="margin: 10px" class="img-wrapper" ><img src="${img.url}" style="width: ${img.width}px; height: ${img.height}px" /><a href="${img.url}" download>Download image</a></div>`;
  });
  document.body.querySelector(".image").innerHTML = text;
});

const onLoadFile = async (event) => {
  try {
    console.log(event);
    // turn array buffer into typed array
    const typedArray = new Uint8Array(event.target.result);

    const text = await getText(typedArray);
    const images = await getImages(typedArray);

    document.body.querySelector(".text").innerHTML = text;

    var imgHtml = "";
    images.forEach((img) => {
      imgHtml += `<div style="margin: 10px" class="img-wrapper" ><img src="${img.url}" style="width: ${img.width}px; height: ${img.height}px" /><a href="${img.url}" download>Download image</a></div>`;
    });
    document.body.querySelector(".image").innerHTML = imgHtml;

    console.log(text, images);
  } catch (error) {
    console.log(error);
  }
};

document.getElementById("file-pdf").addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (file.type !== "application/pdf") {
    alert(`File ${file.name} is not a PDF file type`);
    return;
  }

  const url = URL.createObjectURL(file);
  const ifr = document.body.querySelector("iframe");
  ifr.src = url;

  const fileReader = new FileReader();
  fileReader.onload = onLoadFile;
  fileReader.readAsArrayBuffer(file);
});
