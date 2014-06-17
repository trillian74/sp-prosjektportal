﻿using System;
using System.Text;

namespace Glittertind.Sherpa.Library.ContentTypes.Model
{
    public class GtField
    {
        public Guid ID { get; set; }
        public string InternalName { get; set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
        public string Group { get; set; }
        public string Type { get; set; }
        public string[] Choices { get; set; }
        public string Format { get; set; }
        public string Default { get; set; }
        public bool Hidden { get; set; }

        public Guid SspId { get; set; }
        public Guid TermSetId { get; set; }

        public void InitializeTaxonomyProperties(Guid termStoreId)
        {
            if (Type.StartsWith("TaxonomyFieldType"))
            {
                SspId = termStoreId;
            }
        }

        public string GetFieldAsXml()
        {
            return GetFieldAsXml(false);
        }

        public string GetFieldAsXml(bool required)
        {
            switch (Type)
            {
                case ("TaxonomyFieldType"):
                {
                    return GetSelfClosingFieldXml(required, "ShowField=\"Term1033\" Indexed=\"TRUE\"");
                }
                case ("TaxonomyFieldTypeMulti"):
                {
                    return GetSelfClosingFieldXml(required, "ShowField=\"Term1033\" Mult=\"TRUE\"");
                }
                case ("Choice") :
                {
                    return GetFieldWithContentXml(true, string.Empty, GetChoiceFieldXmlContent());
                }
                default:
                {
                    return GetSelfClosingFieldXml(required, string.Empty);
                }
            }
        }

        private string GetChoiceFieldXmlContent()
        {
            var content =
                new StringBuilder(!string.IsNullOrEmpty(Default)
                    ? string.Format("<Default>{0}</Default>", Default)
                    : string.Empty);
            if (Choices != null && Choices.Length > 0)
            {
                content.AppendLine("<CHOICES>");
                foreach (var choice in Choices)
                {
                    content.AppendFormat("<CHOICE>{0}</CHOICE>", choice);
                }
                content.AppendLine("</CHOICES>");
            }
            return content.ToString();
        }

        /// <summary>
        /// Not too happy with how this is done
        /// </summary>
        /// <param name="required"></param>
        /// <param name="additionalProperties"></param>
        /// <returns></returns>
        private string GetSelfClosingFieldXml(bool required, string additionalProperties)
        {
            var format = !string.IsNullOrEmpty(Format) ? "Format=\"" + Format + "\"" : string.Empty;
            return String.Format(
                "<Field ID=\"{0}\" Name=\"{1}\" DisplayName=\"{2}\" Type=\"{3}\" Hidden=\"{4}\" Group=\"{5}\" Description=\"{6}\" Required=\"{7}\" {8} {9} />",
                ID.ToString("B"), InternalName, DisplayName, Type, Hidden, Group, Description, required.ToString().ToUpper(), format, additionalProperties);
        }
        private string GetFieldWithContentXml(bool required, string additionalProperties, string fieldContent)
        {
            return GetSelfClosingFieldXml(required, additionalProperties)
                    .Replace("/>", String.Format(">{0}</Field>", fieldContent));
        }

        public override string ToString()
        {
            return GetFieldAsXml();
        }
    }
}