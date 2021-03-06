define([], function()
{
    var services = angular.module('app.Services', ['firebase']);

    services.factory('configService', ['$q', '$http', function($q, $http) {

      var sup = this;
      this.data = null;

      this.load = function(){
        var defer = $q.defer();

        if(this.data != null){
          defer.resolve(this.data);
          return defer.promise;
        }

        var path = (String(window.location).indexOf('/adm/')) ? '../js/config.json' : 'js/config.json';

        $http.get(path).success(function(data, status, headers, config) {
          sup.data = data[0];
          defer.resolve(sup.data);
        }).error(function(data, status, headers, config) {
          // called asynchronously if an error occurs
          // or server returns response with an error status.
        });

        return defer.promise;
      }

      return this;

    }]);

    services.factory('datService', ['$q', '$http', 'configService', '$filter', '$firebaseObject', 
      function($q, $http, configService, $filter, $firebaseObject) {

      var sup = this;
      this.categorias = null;
      this.paginas = null;

      var categoriesRef = null;
      var imagesArr = {};
      var pagesRef = null;
      var loadedPaginas = null;
      var loadedCategories = null;


      this.loadData = function(){
        var defer = $q.defer();

        if(loadedPaginas == null || loadedCategories == null){
          configService.load().then(function(data){

            categoriesRef = firebase.database().ref(data.categoriesRef);
            pagesRef = firebase.database().ref(data.pagesRef);

            var onValue = categoriesRef.on('value', function(dataSnapshot) {
              loadedCategories = dataSnapshot.val();
              categoriesRef.off('value', onValue);

              var onValue = pagesRef.orderByChild("state").startAt('available').endAt('available').on('value', function(dataSnapshot) {
                pagesRef.off('value', onValue);
                firebase.database().goOffline();
                loadedPaginas = dataSnapshot.val();

                defer.resolve({categorias: angular.copy(loadedCategories), paginas: angular.copy(loadedPaginas)});
              });
            });
          });

          return defer.promise;
        }

        defer.resolve({categorias: angular.copy(loadedCategories), paginas: angular.copy(loadedPaginas)});

        return defer.promise;
      }

      this.getImages = function(categoriaId){
        var defer = $q.defer();
        if(!imagesArr[categoriaId]){
          configService.load().then(function(data){
            firebase.database().goOnline();

            var imagesRef = firebase.database().ref(data.imagesRef);
                var onValue = imagesRef.orderByChild("ownerCategoria").startAt(categoriaId).endAt(categoriaId).on("value", function(snapshot) {
                  imagesRef.off('value', onValue);
                  firebase.database().goOffline();

                  if(snapshot.val() != null){
                    imagesArr[categoriaId] = snapshot.val();
                  }else{
                    imagesArr[categoriaId] = "EMPTY";
                  }
                  defer.resolve(imagesArr[categoriaId]);
                });
          });
        }else{
          defer.resolve(imagesArr[categoriaId]);
        }

        return defer.promise;
      }

      this.deletePageImages = function(pageId){
        var defer = $q.defer();
        var deletedImages = new Array();

        configService.load().then(function(data){

          var imagesRef = firebase.database().ref(data.imagesRef);
          var onValue = imagesRef.orderByChild("owner").startAt(pageId).endAt(pageId).on("value", function(snapshot) {
            imagesRef.off('value', onValue);

            var pageImages = snapshot.val();
            for(i in pageImages){
              var ref = firebase.database().ref(data.imagesRef+'/'+i);
                  ref.remove();
                  deletedImages.push(i);
            }

            defer.resolve(deletedImages);
          });
        });

        return defer.promise;
      }

      this.getImage = function(categoriaId, pageId){
        var defer = $q.defer();

        this.getImages(categoriaId).then(function(images){
          if(images != "EMPTY"){
            defer.resolve(images[pageId]);
          }else{
            defer.reject();
          }
        });

        return defer.promise;
      }

      function filterPages(slug){
        var categoria;
        var paginas = new Array();

        angular.forEach(sup.categorias, function(value, key) {
          if(value.slug == slug){
            categoria = value;
            categoria.$id = key;
          }
        });

        angular.forEach(sup.paginas, function(value, key) {
          if(value.parentId == categoria.$id){
            paginas.push(value);
          }
        });

        return {paginas: paginas, categoria: categoria};
      }

      this.getPages = function(slug){
        var defer = $q.defer();

        sup.getData().then(function(){
          defer.resolve(filterPages(slug));
        });

        return defer.promise;
      }

      this.getPage = function(slug){
        var defer = $q.defer();

        sup.getData().then(function(){
          var pagina;

          angular.forEach(sup.paginas, function(value, key) {
            if(value.slug == slug){
              pagina = value;
            }
          });

          defer.resolve(pagina);
        });

        return defer.promise;
      }

      this.getData = function(){
        var defer = $q.defer();

        this.loadData().then(function(data){
          sup.paginas = data.paginas;
          sup.categorias = {};

          angular.forEach(sup.paginas, function(value, key){
            value.$id = key;
          });

          angular.forEach(sup.paginas, function(value, key){
              var parent = value.parentId;
              if(data.categorias[parent] && value.state == "available"){
                sup.categorias[parent] = data.categorias[parent];
                sup.categorias[parent].url = (sup.categorias[parent].url)? '/pages/'+sup.categorias[parent].slug : '/'+value.slug;
              }
          });

          defer.resolve();
        });

        return defer.promise;
      }

      return this;

    }]);


    return services;
});