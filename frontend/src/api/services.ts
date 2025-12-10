import { request } from "./client";



export interface Service {

  id: string;

  name: string;

  teamId: string;

  createdAt: string;

}



export async function getServices() {

  return request<Service[]>("/services");

}



export async function createService(data: { name: string; teamId: string }) {
  return request<Service>("/services", {
    method: "POST",
    body: data
  });
}



export async function updateService(id: string, data: { name: string; teamId: string }) {
  return request<Service>(`/services/${id}`, {
    method: "PUT",
    body: data
  });
}



export async function deleteService(id: string) {

  return request<void>(`/services/${id}`, {

    method: "DELETE"

  });

}
