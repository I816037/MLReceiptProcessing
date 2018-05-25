sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/ui/model/json/JSONModel",
	"sapui5ml/CamanJS/dist/caman.full.min"
], function(Controller, MessageToast, JSONModel, Caman) {
	"use strict";
	var _this = this,
		_sOCRDataModel = "OCR_Data",
		_sTextAnalysisDataModel = "TextAnalysis",
		_sMLApiModelName = "ML_Api",
		_srcFile = null,
		_srcImageURL = null,
		_srcPDFURL = null,
		_srcFileIsImage = null,
		_srcFileIsPDF = null,
		_modifiedImage = null;

	return Controller.extend("sapui5ml.controller.main", {

		onInit: function() {
			//OCR Data Model
			var oJsonModel = new JSONModel();
			this.getView().setModel(oJsonModel, _sOCRDataModel);
			this.getView().setModel(oJsonModel, _sTextAnalysisDataModel);
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

			this._srcFileIsImage = false;
			this._srcFileIsPDF = false;

			// keep a reference of the uploaded files
			//var mode = oControlEvent.getSource().data("mode");
			for (var fileIndex = 0; fileIndex < oControlEvent.getParameters().files.length; fileIndex++) {
				_srcFile = oControlEvent.getParameters().files[fileIndex];
				if (_srcFile.type.match("image.*")) {
					this._srcImageURL = URL.createObjectURL(_srcFile);
					this._srcFileIsImage = true;
					this._srcFileIsPDF = false;
				} else if (_srcFile.type.match("pdf.*")) {
					this._srcPDFURL = URL.createObjectURL(_srcFile);
					this._srcFileIsImage = false;
					this._srcFileIsPDF = true;
				} else {
					this._srcFileIsImage = false;
					this._srcFileIsPDF = false;
				}

				// create the form data to be sent in the request
				var formData = new window.FormData();
				formData.append("files", _srcFile, _srcFile.name);
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
			this.getView().getModel(_sOCRDataModel).setProperty("/resultOCR", sResult);
			this.getView().getModel(_sOCRDataModel).setProperty("/resultVisible", true);
			if (this._srcFileIsImage === true) {
				this.getView().getModel(_sOCRDataModel).setProperty("/resultImageUrl", this._srcImageURL);
				this.getView().getModel(_sOCRDataModel).setProperty("/resultPdfUrl", undefined);
			} else if (this._srcFileIsPDF === true) {
				this.getView().getModel(_sOCRDataModel).setProperty("/resultPdfUrl", this._srcPDFURL);
				this.getView().getModel(_sOCRDataModel).setProperty("/resultImageUrl", undefined);
			}

            //Call Text Analysis API
			this.callTextAnalysisAPIToken(sResult);

			// close the busy indicator
			this.oBusyIndicator.close();
		},

		onOCRDetectedFailed: function() {
			var oView = this.getView();
			//console.log(data);
			oView.getModel(_sOCRDataModel).setProperty("/resultOCR", null);
			oView.getModel(_sOCRDataModel).setProperty("/resultVisible", false);
			this.getView().getModel(_sOCRDataModel).setProperty("/resultImageUrl", undefined);
			this.getView().getModel(_sOCRDataModel).setProperty("/resultPdfUrl", undefined);

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

		onBrightnessSliderChange: function(oEvent) {
			var oImage = sap.ui.getCore().byId(this.createId("idImage"));
			var sValue = oEvent.getParameter("value");
			_this.Caman("#" + oImage.sId, function() {
				this.revert(true);
				this.brightness(sValue).render();
				_this._modifiedImage = this.toImage();
			});
		},

		onSharpenSliderChange: function(oEvent) {
			var oImage = sap.ui.getCore().byId(this.createId("idImage"));
			var sValue = oEvent.getParameter("value");
			_this.Caman("#" + oImage.sId, function() {
				this.revert(true);
				this.sharpen(sValue).render();
				_this._modifiedImage = this.toImage();
			});
		},

		onRerunOCRBtn: function() {
			if (_this._modifiedImage === undefined) {
				return;
			}

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

			var oFile = this.dataURLtoBlob(_this._modifiedImage.src);

			// create the form data to be sent in the request
			var formData = new window.FormData();
			formData.append("files", oFile, "filename.png");
			formData.append("lang", "en");
			formData.append("output_type", "txt");
			formData.append("page_seg_mode", "1");
			formData.append("model_type", "lstm_standard");

			// call the service
			//this.callService(this, service, url, type, mode, apiKey, formData, processResult);
			this.webRequest(formData, url, sHeaders, this.onOCRDetectedSuccess.bind(this), this.onOCRDetectedFailed);
		},

		dataURLtoBlob: function(dataurl) {
			var arr = dataurl.split(","),
				mime = arr[0].match(/:(.*?);/)[1],
				bstr = atob(arr[1]),
				n = bstr.length,
				u8arr = new Uint8Array(n);
			while (n--) {
				u8arr[n] = bstr.charCodeAt(n);
			}
			return new Blob([u8arr], {
				type: mime
			});
		},

		callTextAnalysisAPIToken: function(sData) {
			// token
			var that = this;
			var clientId = "sb-na-1cd1c18f-0e54-4bf0-b14c-1785834143a9!t1800";
			var clientSecret = "E+IsgXd/UQYLDlnzQwpIfwdAWwQ=";

			$.ajax({
				type: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				//url: "https://textanalysis.authentication.sap.hana.ondemand.com/oauth/token",
				url: "/ta-token", //Under Cloud Platform Destinations
				data: {
					"client_secret": clientSecret,
					"client_id": clientId,
					"grant_type": "client_credentials"
				},
				success: function(json) {
					var token = $(json.access_token);
					that.callTextAnalysisAPI(token, sData);
					//                                                                                            console.log("token: " + token);
				},
				error: function(jqXHR, status, err) {
					that.alert("Error occured");
				}
			});
		},

		callTextAnalysisAPI: function(token, sData) {
			var that = this;
			$.ajax({
				type: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
					"dataType": "json",
					"Cache-Control": "no-cache",
					"Connection": "keep-alive",
					"Accept-Encoding": "gzip",
					"Taaas-tenant": "textanalysis",
					"Taaas-account": "taaas-dev",
					"Authorization": "Bearer " + token.selector
				},
				data: JSON.stringify({
					"content": sData,
					"contentType": "text",
					"requestOptions": {
						"languages": "en",
						"baseConfiguration": "entityExtraction"
					}
				}),
				//url: "https://textanalysis-staging.cfapps.sap.hana.ondemand.com/textanalysis/v2/analyze",
				url: "/ta/v2/analyze", //Under Cloud Platform Destinations
				success: function(json) {
					var response = json;
					that.processTextAnalysisAPI(response);
				},
				error: function(jqXHR, status, err) {
				}
			});
		},
		processTextAnalysisAPI: function(response) {
			this.getView().getModel(_sOCRDataModel).setProperty("/resultTA", response);	
		}
	});
});