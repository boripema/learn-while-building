"use strict";
// Packaging copies the two Python modules from their single maintained source.
const fs = require("fs");
const path = require("path");
for (const name of ["visual.py", "practice.py"]) {
  fs.copyFileSync(
    path.resolve(__dirname, "../../hooks", name),
    path.resolve(__dirname, "..", name),
  );
}
