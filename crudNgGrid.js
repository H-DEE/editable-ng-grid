'use strict';

/**
 * Component to include an editable datagrid on a webpage. Uses ng-grid as the core solution to generate grid structure.
 *
 * Module Name: crudNgGrid
 * Author: 		H.D.
 * Dependencies: - ngGrid (DataGrid), ui.bootstrap (Modals), toastr (Notification Popups), 
 *                 ngGridFlexibleHeightPlugin (ngGrid Plugin for Flexible height grid),
 *                 ngGridSingleSelectionPlugin (ngGrid Plugin for Single Row Selection when not clicking on Row Checkbox),
 */
angular.module('crudNgGrid',['ngGrid', 'ui.bootstrap', 'toastr'])


/**
 * Directive to include the ediable ngGrid on the UI side.
 * 
 * @param  crudNgGridSvc Dedicated service to make HTTP GET and POST requests.
 * @param  $modal        Modal Generation (ui.bootstrap)
 * @param  $compile      Angular Service to compile a section of HTML on-demand, and link it to the Angular scope.
 * @param  toastr        Service to display popup notifications
 * @param  $timeout      AngularJS implementation of setTimeout function, to run a callback function after a given amount of delay
 *
 * Example: <div editable-ng-grid grid-config="gridConfig"></div>
 * 
 */
.directive('editableNgGrid', ['crudNgGridSvc', '$modal', '$compile', 'toastr', '$timeout', function(crudNgGridSvc, $modal, $compile, toastr, $timeout){
  
  return {
    
    /**
     * Directive can be used either as an attribute or an HTML element itself.
     */
    restrict: 'AE',

    /**
     * Objects available on the directive scope from the outside.
     * gridConfig parameter takes an input configuration object to configure the grid.
     * Use "grid-config" as the attribute to the element where directive is attached.
     */
    scope: {
      gridConfig: "="
    },

    /**
     * Template URL to load on the UI side, when directive is rendered.
     * Refer to $templateCache service.
     */
    templateUrl: 'directiveTempl.html',

    /**
     * Controller function linked to the directive.
     * 
     * @param  $scope   Scope of the controller
     * @param  $element DOM element of the directive.
     */
    controller: function ($scope, $element) {
      
      $scope.griData = undefined;
      
      /** 
       * Default Configuration for NgGrid.
       * Any ng-grid specific configuration can be added here. Applicable to all instance of the grid.
       */
      $scope.gridOptions = {
        data: 'gridData',
        columnDefs: angular.copy($scope.gridConfig.columnDefs),
        showFooter: true,
        showFilter: true,
        showColumnMenu: true,
        enableColumnResize: true,
        selectedItems: [],
        plugins: [new ngGridFlexibleHeightPlugin(), new ngGridSingleSelectionPlugin()]
      };

      /**
       * If Pagination is disabled, get all the grid data directly from the source
       */
      if(!$scope.gridConfig.hasOwnProperty('enablePagination') || $scope.gridConfig.enablePagination == false) {
        crudNgGridSvc.getData($scope.gridConfig.sourceUrl, $scope.gridConfig.requestParams).then(function(data){
          $scope.gridData = data;
        });
      }

      /** 
       * If Pagination is enabled, use the Pagination API to convert the data stream into pages for client-side pagination.
       */
      if($scope.gridConfig.hasOwnProperty('enablePagination') && $scope.gridConfig.enablePagination == true) {
        $scope.filterOptions = {
          filterText: ""
        };

        /** 
         * If custom Paging Options are not defined, use the default one.
         * Refer to NgGrid documentation for detailed description on the pagingOptions parameters.
         */
        if($scope.gridConfig.hasOwnProperty('pagingOptions')) {
          $scope.pagingOptions = $scope.gridConfig.pagingOptions;
        }
        else {
          $scope.pagingOptions = {
            pageSizes: [25, 50, 100],
            pageSize: 25,
            totalServerItems: 0,
            currentPage: 1
          };
        }

        $scope.setPagingData = function(data, page, pageSize) {
          var pagedData = data.slice((page - 1) * pageSize, page * pageSize);
          $scope.gridData = pagedData;
          $scope.pagingOptions.totalServerItems = data.length;
          if (!$scope.$$phase) {
            $scope.$apply();
          }
        };

        $scope.getPagedDataAsync = function(pageSize, page) {
          setTimeout(function() {
            crudNgGridSvc.getData($scope.gridConfig.sourceUrl, $scope.gridConfig.requestParams).then(function(data){
              $scope.setPagingData(data, page, pageSize);
            });
          }, 100);
        };

        $scope.$watch('pagingOptions', function() {
          $scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage, $scope.filterOptions.filterText);
        }, true);

        $scope.gridOptions.enablePaging = true;
        $scope.gridOptions.pagingOptions = $scope.pagingOptions;

        /** 
         * Convert Pagination elements on the UI to Bootstrap-styled ones
         */
        $timeout(function() {
          angular.element('.ngRowCountPicker > select')
            .css('margin-left','5px')
            .addClass('form-control');
          angular.element('.ngPagerButton')
            .addClass('btn btn-sm btn-default');
          angular.element('.ngPagerCurrent')
            .addClass('form-control')
            .css('display','inline');
        },100);
      }

      /**
       * Template for Edit and Delete buttons in the Actions column.
       */
      var actionBtnsTempl = "<div class='text-center margin-top-5'>"+
          "<button type='button' ng-click='openEditBox($event)' class='btn btn-xs btn-primary margin-right-5'>"+
          "    <i class='fa fa-edit'></i>"+
          "</button>"+
          "<button type='button' ng-click='openDeleteModal($event)' class='btn btn-xs btn-danger'>"+
          "    <i class='fa fa-times'></i>"+
          "</button></div>";

      /** 
       * Show "Add Row" button if the enableRowAddition property is True
       */
      if($scope.gridConfig.hasOwnProperty('enableRowAddition') && $scope.gridConfig.enableRowAddition == true) {
        $scope.showAddBtn = true;
      }
      else {
        $scope.showAddBtn = false;
      }

      /** 
       * Show "Delete Multiple" button if the enableMultipleDelete property is True
       */
      if($scope.gridConfig.hasOwnProperty('enableMultipleDelete') && $scope.gridConfig.enableMultipleDelete == true) {
        $scope.showDelBtn = true;

        /** 
         * Making sure the multiple selections work only if the checkbox is selected.
         * Refer to the ngGridSingleSelectionPlugin() ngGrid plugin
         */
        $scope.gridOptions.showSelectionCheckbox = true;
        $scope.gridOptions.selectWithCheckboxOnly = true;
      }
      else {
        $scope.showDelBtn = false;
      }

      /** 
       * Add Actions column if Edit/Deletion is allowed on the grid.
       */
      if($scope.gridConfig.hasOwnProperty('enableEditDelete') && $scope.gridConfig.enableEditDelete == true) {
        $scope.gridOptions.columnDefs.push({displayName:'Actions', cellTemplate: actionBtnsTempl});
      }

      /**
       * Row Edit Handler. Opens a Modal popup display Edit form for the selected row.
       * 
       * @param  e AngularJS's $event object reference
       */
      $scope.openEditBox = function(e) {

        /**
         * If User wants load a custom form template for the Row Editing process, user can provide the following params:
         *   1. editConfig.customTempl (Template URL for the form to be opened in the Modal).
         *   2. editConfig.controller (Modal Controller for the Form template)
         *   3. editConfig.afterSubmit (Callback Function to be executed after Action is submitted from the Modal)
         */
        if($scope.gridConfig.editConfig.hasOwnProperty('customTempl')) {

          var modalInstance = $modal.open({
            backdrop: 'static',
            templateUrl: $scope.gridConfig.editConfig.customTempl,
            controller: $scope.gridConfig.editConfig.modalCtrl,
            
            /**
             * Passing User-defined Grid-Configuration object, and selectedItems array for the grid.
             */
            resolve: {
              gridConfig: function() {
                return $scope.gridConfig;
              },
              selectedItems: function() {
                return $scope.gridOptions.selectedItems;
              }
            }
          });

          modalInstance.result.then($scope.gridConfig.editConfig.afterSubmit);
        }

        /**
         * Otherwise, load the default template and its associated Modal Controller. 
         * The function callback executed upon Submit is pre-defined in this case.
         */
        else {

          var modalInstance = $modal.open({
            backdrop: 'static',
            
            /**
            * Refer to $templateCache service.
            */
            templateUrl: 'default-edit.html',
            controller: ConfirmActionModalCtrl,
            resolve: {
              gridConfig: function() {
                return $scope.gridConfig;
              },
              selectedItems: function() {
                return $scope.gridOptions.selectedItems;
              }
            }
          });

          modalInstance.result.then(function (updConfigObj) {
            if(updConfigObj != undefined) {

              /**
               * In case of Edit/Update action, get both the Old and Updated version of the record,
               * and Submit it together as POST request, under a single object.
               */
              var postObj = {
                oldObj: updConfigObj.oldObj,
                newObj: updConfigObj.newObj,
              }

              /** 
               * HTTP POST request to execute the Edit action.
               * @param  URL
               * @param  POST object
               * @return Promise - resolved using then(successFn, errorFn)
               */
              crudNgGridSvc.postData($scope.gridConfig.editConfig.url, postObj).then(function(data) {
                toastr.success(data , "Success");
              },function(error) {
                toastr.error(error , "ERROR!");
              });
            }
          });

        }
      }

      /**
       * Row Add Handler. Opens a Modal popup display Add form for the selected row.
       * 
       * @param  e AngularJS's $event object reference
       */
      $scope.openAddBox = function(e) {

        /**
         * If User wants load a custom form template for the Row Addition process, user can provide the following params:
         *   1. addConfig.customTempl (Template URL for the form to be opened in the Modal).
         *   2. addConfig.controller (Modal Controller for the Form template)
         *   3. addConfig.afterSubmit (Callback Function to be executed after Action is submitted from the Modal)
         */
        if($scope.gridConfig.addConfig.hasOwnProperty('customTempl')) {
          var modalInstance = $modal.open({
            backdrop: 'static',
            templateUrl: $scope.gridConfig.addConfig.customTempl,
            controller: $scope.gridConfig.addConfig.modalCtrl,
            
            /**
             * Passing User-defined Grid-Configuration object, and selectedItems array for the grid.
             */
            resolve: {
              gridConfig: function() {
                return $scope.gridConfig;
              },
              selectedItems: function() {
                return $scope.gridOptions.selectedItems;
              }
            }
          });

          modalInstance.result.then($scope.gridConfig.editConfig.afterSubmit);
        }

        /**
         * Otherwise, load the default template and its associated Modal Controller. 
         * The function callback executed upon Submit is pre-defined in this case.
         */
        else {

          var modalInstance = $modal.open({
            backdrop: 'static',

            /**
            * Refer to $templateCache service.
            */
            templateUrl: 'default-add.html',
            controller: ConfirmActionModalCtrl,

            /**
             * Passing User-defined Grid-Configuration object, and selectedItems array for the grid.
             */
            resolve: {
              gridConfig: function() {
                return $scope.gridConfig;
              },
              selectedItems: function() {
                return $scope.gridOptions.selectedItems;
              }
            }
          });

          modalInstance.result.then(function (updConfigObj) {
            if(updConfigObj != undefined) {
              
              var postObj = {};
              
              /**
               * In case of Add action, get the values for indivual fields from the columnDefs property of the configuration object.
               */
              angular.forEach(updConfigObj.columnDefs, function(prop) {
                postObj[prop.field] = prop.value;
              });

              /** 
               * HTTP POST request to execute the Add action.
               * @param  URL
               * @param  POST object
               * @return Promise - resolved using then(successFn, errorFn)
               */
              crudNgGridSvc.postData($scope.gridConfig.addConfig.url, postObj).then(function(data) {
                toastr.success(data , "Success");
              },function(error) {
                toastr.error(error , "ERROR!");
              });
            }
          });
        }
      }

      /**
       * Row(s) Delete Handler. Opens a Delete Confirmation Modal popup
       * 
       * @param  e AngularJS's $event object reference
       */
      $scope.openDeleteModal = function(e) {

        /**
         * deleteConfig.url property is required in this case.
         */
        if($scope.gridConfig.hasOwnProperty('deleteConfig')) {

          var modalInstance = $modal.open({
            backdrop: 'static',

            /**
            * Refer to $templateCache service.
            */
            templateUrl: 'confirm-delete.html',
            controller: ConfirmActionModalCtrl,
            resolve: {
              gridConfig: function() {
                return $scope.gridConfig;
              },
              selectedItems: function() {
                return $scope.gridOptions.selectedItems;
              }
            }
          });

          modalInstance.result.then(function (updConfigObj) {
            if(updConfigObj != undefined) {

              /** 
               * HTTP POST request to execute the Delete action.
               * @param  URL
               * @param  POST object (List of record(s) to be deleted)
               * @return Promise - resolved using then(successFn, errorFn)
               */
              crudNgGridSvc.postData($scope.gridConfig.deleteConfig.url, updConfigObj.oldObj).then(function(data) {
                toastr.success(data , "Success");
              },function(error) {
                toastr.error(error , "ERROR!");
              });
            }
          });
        }

      }

      /**
       * Default Modal Controller to handle Add/Update/Delete actions
       *
       * @param  $scope         Scope of the Modal Controller
       * @param  $modalInstance Required parameter for Modal Controllers
       * @params gridConfig     Grid Configuration object passed from the parent Controller using resolve property of modalInstance
       * @params selectedItems  List of Selected Items in the grid, passed from the parent Controller using resolve property of modalInstance
       */
      var ConfirmActionModalCtrl = function ($scope, $modalInstance, gridConfig, selectedItems) {
        $scope.gridConfig = angular.copy(gridConfig);
        $scope.selectedItems = selectedItems;

        /** 
         * Create a copy of selected records as soon as they're available.
         */
        $scope.$watch('selectedItems.length',function(newValue, oldValue) {
          if(newValue != 0) {
            $scope.origSelectedItems = angular.copy($scope.selectedItems);
            $scope.selectedItems = angular.copy($scope.selectedItems);
          }
        });

        /**
         * Submit Action handler
         */
        $scope.ok = function () {

          /** 
           * Attach both Old and New/Modified Row Objects to the configuration, and pass it back to the parent controller
           */
          $scope.gridConfig.oldObj = $scope.origSelectedItems;
          $scope.gridConfig.newObj = $scope.selectedItems;
          $modalInstance.close($scope.gridConfig);
        };

        /** 
         * Cancel Action handler
         */
        $scope.cancel = function () {
          $modalInstance.dismiss('cancel');
        };
      };


    }
  }
}])

/** 
 * Dedicated Factory Service to handle HTTP requests for the Grid.
 *
 * @param  $q     AngularJS Promise API service
 * @param  $http  HTTP Service implementation provided by AngularJS
 * 
 */
.factory('crudNgGridSvc', ['$q', '$http', function(q, http){
  return {

    /**
     * HTTP GET REQUEST
     * @param  url    URL for the HTTP Request
     * @param  params GET request URL parameters object
     * @return Promise
     */
    getData: function(url, params) {
      var d = q.defer();

      http.get(url, { params: params}).success(function(data){
        if(data !=null && data.hasOwnProperty("errorStatus")) {
          d.reject(data.errorMsg);
        }
        else {
          d.resolve(data);
        }
      }).error(function(data) {
        d.reject(data);
      });

      return d.promise;
    },
    
    /**
     * HTTP POST REQUEST
     * @param  url  URL for the HTTP Request
     * @param  obj  POST request data object (passed as Request Body)
     * @return Promise
     */
    postData: function(url, obj) {
      var d = q.defer();

      http.post(url, obj)
      .success(function(data){
        if(data.hasOwnProperty("errorStatus")) {
          d.reject(data.errorMsg);
        }
        else {
          d.resolve(data);
        }
      }).error(function(data) {
        d.reject(data);
      });

      return d.promise;
    },

  };
}])

/**
 * Template Cache Service to store pre-defined templates for Modals and Directive.
 */
.run(["$templateCache", function($templateCache) {
  
  /** 
   * Delete Modal template
   */
  $templateCache.put("confirm-delete.html",
                     "<div class=\"modal-header\">" +
                     "  <h3 class='modal-title'>Confirm Delete?</h3>" +
                     "</div>"+
                     "<div class=\"modal-body\">"+
                     "  <p><span class=\"fa fa-warning\"></span> Are you sure you want to delete the selected entries?</p>"+
                     "</div>"+
                     "<div class=\"modal-footer\">"+
                     "  <button class=\"btn btn-primary\" ng-click=\"ok()\">Delete</button>"+
                     "  <button class=\"btn btn-danger\" ng-click=\"cancel()\">Cancel</button>"+
                     "</div>");

  /**
   * Default template for Add modal
   */
  $templateCache.put("default-add.html",
                     "<div class=\"modal-header\">" +
                     "  <h3 class='modal-title'>Add New Record</h3>" +
                     "</div>"+
                     "<div class=\"modal-body\">"+
                     "  <div class='row' style='margin-bottom: 5px' ng-repeat='param in gridConfig.columnDefs'>"+
                     "    <div class='col-md-4 text-right'><label>{{ param.displayName }} </label></div>"+
                     "    <div class='col-md-4'><input type='text' class='form-control' ng-model='param.value' name='{{ param.field }}' id='{{ param.id }}'></div>"+
                     "</div>"+
                     "<div class=\"modal-footer\">"+
                     "  <button class=\"btn btn-primary\" ng-click=\"ok()\">Submit</button>"+
                     "  <button class=\"btn btn-danger\" ng-click=\"cancel()\">Cancel</button>"+
                     "</div>");

  /**
   * Default template for Edit modal.
   */
  $templateCache.put("default-edit.html",
                     "<div class=\"modal-header\">" +
                     "  <h3 class='modal-title'>Modify Record</h3>" +
                     "</div>"+
                     "<div class=\"modal-body\">"+
                     "  <div class='row' style='margin-bottom: 5px' ng-repeat='param in gridConfig.columnDefs'>"+
                     "    <div class='col-md-4 text-right'><label>{{ param.displayName }} </label></div>"+
                     "    <div class='col-md-4'><input type='text' class='form-control' ng-model='selectedItems[selectedItems.length-1][param.field]' name='{{ param.field }}' id='{{ param.id }}'></div>"+
                     "</div>"+
                     "<div class=\"modal-footer\">"+
                     "  <button class=\"btn btn-primary\" ng-click=\"ok()\">Submit</button>"+
                     "  <button class=\"btn btn-danger\" ng-click=\"cancel()\">Cancel</button>"+
                     "</div>");

  /** 
   * Directive template, initiating ng-grid interally upon execution.
   */
  $templateCache.put("directiveTempl.html",
                     "<div id=\"{{ gridConfig.gridId }}\">" +
                     "  <div id=\"{{ gridConfig.gridButtonsId }}\" style=\"margin: 10px 0 10px 5px\">"+
                     "    <button ng-show='showAddBtn' class='btn btn-sm btn-primary' type='button' ng-click='openAddBox($event)'><i class='fa fa-plus'></i> Add New</button>"+
                     "    <button ng-show='showDelBtn' class='btn btn-sm btn-danger' type='button' ng-click='openDeleteModal($event)'><i class='fa fa-times'></i> Delete Selected</button>" +
                     "  </div>"+
                     "  <div class=\"gridStyle\" ng-grid=\"gridOptions\"></div>"+
                     "</div>");

}]);