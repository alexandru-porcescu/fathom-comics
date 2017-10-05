// Unless you use Safari Technology Preview (11.1, in my case), this will throw
// NoSuchWindowErrors.

const {readFileSync, writeFile, readdirSync, statSync} = require('fs');
const {dirname, join} = require('path');
const webdriver = require('selenium-webdriver');
const {Options} = require('selenium-webdriver/safari');


function writeToFile(path, thing){
  writeFile(path, thing, 'utf-8', (err) => {
    if (err) {
      console.log('ERROR: ', err);
      throw err;
    }
  });
}

function extract(absSubfolderPath) {
  const callback = arguments[arguments.length - 1];
  const nodeProperties = [];  // TODO: make it an array
  const html = document.documentElement.outerHTML;
  const all = document.getElementsByTagName('*');
  for (let j = 0; j < all.length; j++) {
       const curNode = all[j];
       const curRect = curNode.getBoundingClientRect();
       nodeProperties.push({'top': curRect.top,
                            'bottom': curRect.bottom,
                            'left': curRect.left,
                            'right': curRect.right
                           });
  }

  setTimeout(function () {
    callback({
      html,
      nodeProperties,
      absSubfolderPath
    });
  });
}

function dirsIn(path) {
  return readdirSync(path).filter(f => statSync(join(path, f)).isDirectory());
}

if (require.main === module) {
  const training = join(__dirname, 'corpus' , 'training');
  const options = new Options().setCleanSession(true)
                               .setTechnologyPreview(true);
  const driver = new webdriver.Builder()
                              .withCapabilities(webdriver.Capabilities.safari())
                              .setSafariOptions(options)
                              .build();
  driver.manage().window().setSize(1366, 768);
  driver.manage().timeouts().setScriptTimeout(100000);

  dirsIn(training).forEach(function(subfolder){
      const absSubfolderPath = join(training, subfolder);
      const archiveUrl = 'file://' + join(absSubfolderPath, 'archive.webarchive');
      driver.get(archiveUrl);

      driver.executeAsyncScript(extract, absSubfolderPath).then(function(docInfo) {
        writeToFile(join(docInfo.absSubfolderPath, 'source.html'), String(docInfo.html));  // possibly mutated by the JS, I suppose
        writeToFile(join(docInfo.absSubfolderPath, 'nodes.json'), JSON.stringify(docInfo.nodeProperties));
    });
  });
  driver.close();
}
