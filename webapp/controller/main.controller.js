sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/ui/model/json/JSONModel",
	"sapui5ml/CamanJS/dist/caman.full.min"
], function(Controller, MessageToast, JSONModel, Caman) {
	"use strict";
	var _this = this,
	    _sOCRDataModelName = "OCR_Data",
		_sMLApiModelName = "ML_Api",
		_srcImageURL = null,
		_srcPDFURL = null,
		_srcFileIsImage = null,
		_srcFileIsPDF = null;

	return Controller.extend("sapui5ml.controller.main", {

		onInit: function() {
			//OCR Data Model
			var oJsonModel = new JSONModel();
			this.getView().setModel(oJsonModel, _sOCRDataModelName);
		}, // onInit

		fileTypeMissmatch: function(oControlEvent) {
			MessageToast.show("Wrong file type!");
		},

		/*Based on https://answers.sap.com/questions/375313/regarding-usage-of-optical-character-recognition-o.html*/
		getOCR: function(oControlEvent) {

			// start the busy indicator
			this.oBusyIndicator = new sap.m.BusyDialog();
			this.oBusyIndicator.open();

			var oView = this.getView();
			var url = oView.getModel(_sMLApiModelName).getProperty("/urlOCR");
			var apiKey = oView.getModel(_sMLApiModelName).getProperty("/apiKey");

			var sHeaders = {
				"Accept": "application/json",
				"APIKey": apiKey
			};

			var srcFile = null;
			this._srcFileIsImage = false;
			this._srcFileIsPDF = false;

			// keep a reference of the uploaded files
			//var mode = oControlEvent.getSource().data("mode");
			for (var fileIndex = 0; fileIndex < oControlEvent.getParameters().files.length; fileIndex++) {
				srcFile = oControlEvent.getParameters().files[fileIndex];
				if (srcFile.type.match("image.*")) {
					this._srcImageURL = URL.createObjectURL(srcFile);
					this._srcFileIsImage = true;
					this._srcFileIsPDF = false;
				} else if (srcFile.type.match("pdf.*")) {
					this._srcPDFURL = URL.createObjectURL(srcFile);
					this._srcFileIsImage = false;
					this._srcFileIsPDF = true;
				} else {
					this._srcFileIsImage = false;
					this._srcFileIsPDF = false;
				}

				// create the form data to be sent in the request
				var formData = new window.FormData();
				formData.append("files", srcFile, srcFile.name);
				formData.append("lang", "en");
				formData.append("output_type", "txt");
				formData.append("page_seg_mode", "1");
				formData.append("model_type", "lstm_standard");

				// increase request countor to close busy indicator
				this.requestCount++;

				// call the service
				//this.callService(this, service, url, type, mode, apiKey, formData, processResult);
				this.webRequest(formData, url, sHeaders, this.onOCRDetectedSuccess.bind(this), this.onOCRDetectedFailed);
			}
		},

		onOCRDetectedSuccess: function(data) {
			var aData = data.predictions;
			var sResult = "";
			if (aData && data.predictions.length > 0) {
				sResult = data.predictions[0]; //get first
			}
			this.getView().getModel(_sOCRDataModelName).setProperty("/resultOCR", sResult);
			this.getView().getModel(_sOCRDataModelName).setProperty("/resultVisible", true);
			if (this._srcFileIsImage === true) {
				this.getView().getModel(_sOCRDataModelName).setProperty("/resultImageUrl", this._srcImageURL);
				this.getView().getModel(_sOCRDataModelName).setProperty("/resultPdfUrl", undefined);
			} else if (this._srcFileIsPDF === true) {
				this.getView().getModel(_sOCRDataModelName).setProperty("/resultPdfUrl", this._srcPDFURL);
				this.getView().getModel(_sOCRDataModelName).setProperty("/resultImageUrl", undefined);
			}

			// close the busy indicator
			this.oBusyIndicator.close();
		},

		onOCRDetectedFailed: function() {
			var oView = this.getView();
			//console.log(data);
			oView.getModel(_sOCRDataModelName).setProperty("/resultOCR", null);
			oView.getModel(_sOCRDataModelName).setProperty("/resultVisible", false);
			this.getView().getModel(_sOCRDataModelName).setProperty("/resultImageUrl", undefined);
			this.getView().getModel(_sOCRDataModelName).setProperty("/resultPdfUrl", undefined);

			// close the busy indicator
			this.oBusyIndicator.close();
		},
		webRequest: function(data, url, header, successcallback, failcallback) {
			var ajaxRequest = {};
			ajaxRequest.url = url;
			ajaxRequest.method = "POST";
			ajaxRequest.headers = header;
			ajaxRequest.data = data;
			ajaxRequest.processData = false;
			ajaxRequest.contentType = false;
			ajaxRequest.cache = false;
			ajaxRequest.success = successcallback.bind(this);
			ajaxRequest.error = failcallback.bind(this);
			jQuery.ajax(ajaxRequest);
		},

		onSliderChange: function(oEvent) {
			var oImage = sap.ui.getCore().byId(this.createId("idImage"));
			var oImageDom = document.getElementById(oImage.sId);
			var oCanvasDom = document.createElement("canvas");
			var oContext = oCanvasDom.getContext("2d");
			Controller.apply(this, arguments);

			oCanvasDom.width = oImageDom.width;
			oCanvasDom.height = oImageDom.height;
			oContext.drawImage(oImageDom, 0, 0);
			
			var sValue = oEvent.getParameter("value");
			_this.Caman("#"+oImage.sId, function() {
				this.revert(true);
				this.brightness(sValue).render();
			});
		}
	});
});