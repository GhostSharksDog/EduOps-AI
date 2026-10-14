export interface EntityTypeOption {id:string;value:string;name:string;}
export const entityTypes:EntityTypeOption[]=[
  {
    "id": "d20e65ad-01db-58ed-9496-1b71977d601f",
    "value": "STUDENT",
    "name": "学员"
  },
  {
    "id": "57a628fd-3b98-5525-abbb-b89a2c356c99",
    "value": "PARENT",
    "name": "家长"
  },
  {
    "id": "1f775437-f504-5732-87aa-0597162d75c9",
    "value": "LEAD",
    "name": "线索"
  }
];

/** 保留已有业务记录的实体编号，不批量更改历史数据。 */
export function withLegacyEntityType(id?:string,value?:string):EntityTypeOption[]{
 if(!id||entityTypes.some(item=>item.id===id))return entityTypes;
 return [...entityTypes,{id,value:value??id,name:entityTypes.find(item=>item.value===value)?.name??value??id}];
}
