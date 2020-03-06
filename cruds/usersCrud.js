// ---------------------------------- USERS CRUD -------------------------------------------
module.exports = function(app, db, permissions,bcrypt) {
  app.post("/getUser", function(req, res) {
    var identifiant = req.param("id");

    var ObjectId = require("mongodb").ObjectID; //working
    var idObj = ObjectId(identifiant); //working

    db.collection("users").findOne({ _id: idObj }, function(findErr, result) {
      if (findErr) throw findErr;
      res.send(result);
    });
  });

  app.post("/updateUser", function(req, res) {
    // LOGGED IN CONTROL
    if (!req.session.loggedIn) {
      console.log(" FORBIDDEN ");
      res.status(403).send({ errorCode: "403" });
      return;
    }

    // PERMISSION CONTROL
    if (!permissions.permission_valid("UPDATE_USER", req)) {
      console.log(" NO PERMISSIONS");
      res.status(403).send({ errorCode: "403" });
      return;
    }

    // RECUPERATION DU user provenant du front end
    // GETTIN DATA FROM FRONTEND
    var user = req.body;

    // On évite tout hacking
    user._id = req.session.user._id;
    user.password = req.session.user.password;
    user.last_update = new Date();

   

    // MAJ DE LA SESSION EN MEMOIRE, SINON IL EST FAUSSE
    req.session.user = user;

    var ObjectId = require("mongodb").ObjectID;
    var idObj = ObjectId(user._id);

    // OBLIGATOIRE DE SUPPRIMER _ID DE OBJET USER SINON LE UPDATE NE PASSE PAS SUR MONGODB (CONFLIT)
    delete user._id;

    try {
      db.collection("users").replaceOne({ _id: idObj }, user);
      res.sendStatus(200);
    } catch (e) {
      res.sendStatus(400);
      console.log(e);
    }
  });

  app.post("/insertUser", function(req, res) {
    var user = req.body;

    // CONTROLE DES CHAMPS OBLIGATOIRES
    if (
      !user.prenom ||
      !user.email ||
      !user.password ||
      !user.nom ||
      user.password == ""
    ) {
      res.status(403).send({ errorCode: "403" });
      return;
    }

    user.permissions = create_permissions(user);

     // Setting user files 
     user.filenames = [];
     
    //  PERMISSIONS

    // PERMISSION CONTROL
    if (!permissions.permission_valid("CREATE_USER", req)) {
      console.log(" NO PERMISSIONS");

      return;
    }

    // CONTROLE DE DOUBLONS EMAIL
    db.collection("users").findOne({ email: user.email }, function(
      findErr,
      result
    ) {
      if (!result) {
        execute();
      } else {
        console.log("ya un doublon email");
        res.send({ problem: "doublonEmail" });
        return;
      }
    });

    function execute() {
      // HASCHAGE BCRYPT DU PASSWORD
      var hash = bcrypt.hashSync(user.password, 10);
      user.password = hash;

      try {
        db.collection("users").insertOne(user);
        console.log("ajouté un user");
        res.sendStatus(200);
      } catch (e) {
        console.log(e);
        res.sendStatus(400);
      }
    }
  });

  app.post("/registerUser", function(req, res) {
    var user = req.body;

    // CONTROLE DES CHAMPS OBLIGATOIRES
    if (
      !user.prenom ||
      !user.email ||
      !user.password ||
      !user.nom ||
      user.password == ""
    ) {
      res.send({ problem: "Le formulaire est encore incomplet (serveur)" });
      return;
    }

    // IP FLOODING CONTROL
    // TODO

    //  PERMISSIONS

    //ANONYMOUS ACCOUNT CREATION

    user.role = "user";
    user.permissions = permissions.create_permissions(user);

    // CONTROLE DE DOUBLONS EMAIL
    db.collection("users").findOne({ email: user.email }, function(
      findErr,
      result
    ) {
      if (!result) {
        execute();
      } else {
        console.log("ya un doublon email");
        res.send({ problem: "doublonEmail" });
        return;
      }
    });

    function execute() {
      // HASCHAGE BCRYPT DU PASSWORD
      var hash = bcrypt.hashSync(user.password, 10);
      user.password = hash;

      try {
        db.collection("users").insertOne(user);
        console.log("ajouté un user");
        res.sendStatus(200);
      } catch (e) {
        console.log(e);
        res.sendStatus(400);
      }
    }
  });

  app.post("/deleteUser", function(req, res) {
    // LOGGED IN CONTROL
    if (!req.session.loggedIn) {
      console.log(" FORBIDDEN ");
      res.status(403).send({ errorCode: "403" });
      return;
    }

    // PERMISSION CONTROL
    if (!permissions.permission_valid("DELETE_USER", req)) {
      console.log(" NO RIGHTS");
      res.status(403).send({ errorCode: "403" });
      return;
    }

    var user = req.body;
    var ObjectId = require("mongodb").ObjectID;
    var idObj = ObjectId(user._id);

    try {
      db.collection("users").deleteOne({ _id: idObj });
      console.log("supprimé un user");
      // Delete session
      delete req.session;
      // delete_user_from_all(user);

      res.sendStatus(200);
    } catch (e) {
      console.log(e);
      res.sendStatus(400);
    }
  });

  /*
   * Cleaning empty objects and array
   * Delete any empty array or object from object
   */

  function cleanFilters(obj) {
    for (var propName in obj) {
      if (
        obj[propName] === null ||
        obj[propName] === undefined ||
        obj[propName] === "" ||
        !obj[propName].length
      ) {
        delete obj[propName];
      }
    }
  }
  app.post("/getUsers", function(req, res) {
    console.log(req.sessionID);
    console.log(req.body.filters);
    console.log(typeof req.body.filters);
    console.log(myFilters);

    // ------------------------------- SANS FILTRES :
    if (req.body.filters === undefined) {
      console.log("no filters");
      db.collection("users")
        .find()
        .toArray(function(err, docs) {
          if (err) throw err;
          console.log(err);
          docs = FilterByFilesPermissions(docs, req);
          getUsersGroups(docs, req)
            .then(users => {
              res.send(users);
            })
            .catch(error => {
              // if you have an error
            });
        });
    } else if (
      Object.entries(req.body.filters).length === 0 &&
      req.body.filters.constructor === Object
    ) {
      console.log("no filters");
      db.collection("users")
        .find()
        .toArray(function(err, docs) {
          if (err) throw err;
          console.log(err);
          docs = FilterByFilesPermissions(docs, req);
          getUsersGroups(docs, req)
            .then(users => {
              res.send(users);
            })
            .catch(error => {
              // if you have an error
            });
        });
    } else if (
      Object.entries(req.body.filters).length !== 0 &&
      req.body.filters.constructor === Object
    ) {
      // ------------------------------- AVEC FILTRES :

      var myFilters = req.body.filters;

      cleanFilters(myFilters);
      var find = {};

      find.$and = [];

      if (myFilters.role) {
        find.$and.push({ role: myFilters.role });
      }
      if (myFilters.jobs) {
        find.$and.push({ job: { $in: myFilters.jobs } });
      }

      if (myFilters.users) {
        find.$and.push({ nom: { $in: myFilters.users } });
      }
      if (myFilters.ageValues) {
        find.$and.push(
          { age: { $gt: myFilters.ageValues[0] } },
          { age: { $lt: myFilters.ageValues[1] } }
        );
      }

      db.collection("users")
        .find(find)

        .toArray(function(err, docs) {
          if (err) throw err;
          console.log(err);
          docs = FilterByFilesPermissions(docs, req);
          getUsersGroups(docs, req)
            .then(users => {
              res.send(users);
            })
            .catch(error => {
              // if you have an error
            });
        });
    }
  });

  // CHAINER PLUSIEURS COLLECTIONS CALL EN MODE ASYNC
  async function getUsersGroups(users, req) {
    await Promise.all(
      users.map(user => {
        return db
          .collection("groups")
          .find({ "users._id": String(user._id) })
          .toArray()
          .then(group => {
            user.groups = group;
            console.log(group);
          });
      })
    );

    return users;
  }
  // .find( {},{"projection":{"_id":1, "nom": 1,"img":1,"longitude":1,"latitude":1,"categorie":1,"selectionneurPseudo":1,"selectionneurId":1}} )
  app.post("/getUsersForFilters", function(req, res) {
    db.collection("users")
      .find()
      .sort({ nom: 1 })
      .toArray(function(err, docs) {
        if (err) throw err;
        console.log(err);

        var users = docs.map(function(item) {
          return item["nom"];
        });
        res.send(users);
      });
  });

  /**
   * Filtre les documents des utilisateurs si ils ont la permission ou pas
   *
   */
  function FilterByFilesPermissions(docs, req) {
    docs.forEach(function(doc) {
      if(doc.filnames){// If user own docs
        doc.filenames.forEach(function(file, index, object) {
          if (file.permissions == "all") {
            // We keep the file for display
          } else if (req.session.loggedIn) {
            if (file.permissions == req.session.user._id) {
              // We keep the file for display
            }
          } else {
            object.splice(index, 1);
          }
        });
      }
    });
    return docs;
  }

  app.get("/searchUsers", function(req, res) {
    var pseudoSearch = req.param("pseudo");

    db.collection("users")
      .find({ pseudo: { $regex: pseudoSearch, $options: "i" } })
      .toArray(function(err, docs) {
        if (err) throw err;
        console.log(docs);
        res.send(docs);
      });
  });

  app.get("/getUsersCount", function(req, res) {
    db.collection("users")
      .countDocuments()
      .then(count => {
        res.send({ result: count });
      });
  });
};